<?php

namespace Tests\Support;

use Illuminate\Support\Facades\DB;

/**
 * Contrôles d'intégrité des écritures, réutilisables par les tests. LECTURE
 * SEULE : uniquement des SELECT.
 *
 *  - integriteFinanciere() : les règles que toute opération doit laisser
 *    vraies (dépenses payées ↔ sorties du journal, compensations, virements) ;
 *  - empreinteHistorique() : une empreinte des dépenses de l'ancien système et
 *    de leurs écritures. Elle doit être identique avant et après n'importe
 *    quel test : ces dépenses ne sont jamais modifiées, et aucune nouvelle
 *    sortie ne doit leur être rattachée.
 */
trait VerifieIntegriteFinanciere
{
    /** @return array<string,int> règle => nombre de violations (0 partout si tout est sain) */
    protected function integriteFinanciere(): array
    {
        $n = fn (string $sql, array $b = []) => (int) DB::selectOne("SELECT COUNT(*) AS n FROM ($sql) AS x", $b)->n;
        $v = ['R1' => 0, 'R2' => 0, 'R4' => 0, 'R6' => 0];

        foreach (['achat' => 'id_achat', 'charge' => 'id_charge'] as $t => $pk) {
            // R1 : chaque dépense payée a UNE sortie, de même montant et de même compte, non annulée.
            $v['R1'] += $n("SELECT d.$pk FROM `$t` d
                LEFT JOIN transaction x ON x.id_transaction = d.id_transaction AND x.transaction_type = 'S' AND x.amount = d.montant AND x.account = d.id_compte
                LEFT JOIN transaction inv ON inv.transaction_annulee_id = x.id_transaction
                WHERE d.statut = 'payee' AND (x.id_transaction IS NULL OR inv.id_transaction IS NOT NULL)");

            // R2 : chaque sortie de dépense est rattachée à SA dépense, ou annulée par UNE compensation.
            $v['R2'] += $n("SELECT x.id_transaction FROM transaction x
                LEFT JOIN `$t` d ON d.id_transaction = x.id_transaction AND (x.origine_id IS NULL OR d.$pk = x.origine_id)
                WHERE x.transaction_type = 'S' AND (x.origine_table = ? OR (x.origine_table IS NULL AND x.reson = ?)) AND d.$pk IS NULL
                  AND (SELECT COUNT(*) FROM transaction inv WHERE inv.transaction_annulee_id = x.id_transaction) <> 1", [$t, $t]);

            // R4 : aucune dépense non payée n'a d'écriture rattachée.
            $v['R4'] += (int) DB::table($t)->where('statut', '<>', 'payee')->where('id_transaction', '>', 0)->count();

            // R6 : le dernier événement d'une dépense correspond à son statut actuel.
            $v['R6'] += $n("SELECT d.$pk FROM `$t` d
                JOIN depense_evenements e ON e.id = (SELECT MAX(id) FROM depense_evenements WHERE type_depense = ? AND id_depense = d.$pk)
                WHERE e.statut_apres IS NULL
                   OR CONVERT(e.statut_apres USING utf8mb4) COLLATE utf8mb4_bin <> CONVERT(d.statut USING utf8mb4) COLLATE utf8mb4_bin", [$t]);
        }

        // R3 : chaque compensation vise une écriture existante, de sens opposé, de même montant et de même compte ; une seule par écriture.
        $v['R3'] = $n("SELECT inv.id_transaction FROM transaction inv LEFT JOIN transaction x ON x.id_transaction = inv.transaction_annulee_id
                WHERE inv.transaction_annulee_id IS NOT NULL AND (x.id_transaction IS NULL OR x.transaction_type = inv.transaction_type OR x.amount <> inv.amount OR x.account <> inv.account)")
            + $n('SELECT transaction_annulee_id FROM transaction WHERE transaction_annulee_id IS NOT NULL GROUP BY transaction_annulee_id HAVING COUNT(*) > 1');

        // V1 : un virement journalisé = une sortie et une entrée, même montant, deux comptes, même virement.
        $v['V1'] = $n("SELECT reference_virement FROM transaction WHERE type_operation = 'virement' GROUP BY reference_virement
                HAVING SUM(transaction_type = 'S') <> 1 OR SUM(transaction_type = 'E') <> 1 OR MIN(amount) <> MAX(amount) OR COUNT(DISTINCT account) <> 2 OR COUNT(DISTINCT origine_id) <> 1");

        // V2 : aucune écriture de virement sans référence ni origine.
        $v['V2'] = (int) DB::table('transaction')->whereIn('type_operation', ['virement', 'annulation_virement'])
            ->where(fn ($q) => $q->whereNull('reference_virement')->orWhere('reference_virement', '')->orWhere('origine_table', '<>', 'transfer')->orWhereNull('origine_id'))->count();

        // V3 : un virement est intact, ou compensé par exactement deux écritures de la même référence.
        $v['V3'] = $n("SELECT reference_virement FROM transaction WHERE type_operation = 'annulation_virement' GROUP BY reference_virement HAVING COUNT(*) <> 2")
            + $n("SELECT c.id_transaction FROM transaction c LEFT JOIN transaction x ON x.id_transaction = c.transaction_annulee_id
                WHERE c.type_operation = 'annulation_virement' AND (x.id_transaction IS NULL OR x.type_operation <> 'virement' OR x.reference_virement <> c.reference_virement
                   OR x.transaction_type = c.transaction_type OR x.amount <> c.amount OR x.account <> c.account)");

        // V4 : les virements ne créent ni ne détruisent d'argent.
        $somme = fn (string $sens) => (int) DB::table('transaction')->whereIn('type_operation', ['virement', 'annulation_virement'])->where('transaction_type', $sens)->sum('amount');
        $v['V4'] = (int) ($somme('E') !== $somme('S'));

        // V5 : chaque ligne de virement journalisée pointe sur ses deux écritures, non compensées.
        $v['V5'] = $n("SELECT t.id_transfer FROM transfer t
                LEFT JOIN transaction d ON d.id_transaction = t.id_transaction_debit  AND d.transaction_type = 'S' AND d.account = t.starting_account    AND d.amount = t.amount AND d.origine_id = t.id_transfer AND d.type_operation = 'virement'
                LEFT JOIN transaction c ON c.id_transaction = t.id_transaction_credit AND c.transaction_type = 'E' AND c.account = t.destination_account AND c.amount = t.amount AND c.origine_id = t.id_transfer AND c.type_operation = 'virement'
                WHERE (t.id_transaction_debit IS NOT NULL OR t.id_transaction_credit IS NOT NULL)
                  AND (d.id_transaction IS NULL OR c.id_transaction IS NULL OR d.reference_virement <> c.reference_virement
                       OR EXISTS (SELECT 1 FROM transaction a WHERE a.transaction_annulee_id IN (d.id_transaction, c.id_transaction)))");

        // V6 : aucune écriture de virement active sans ligne de virement, aucune ligne sur un virement compensé.
        $v['V6'] = $n("SELECT x.id_transaction FROM transaction x
                LEFT JOIN transfer t ON x.id_transaction IN (t.id_transaction_debit, t.id_transaction_credit)
                LEFT JOIN transaction a ON a.transaction_annulee_id = x.id_transaction
                WHERE x.type_operation = 'virement' AND ((a.id_transaction IS NULL AND t.id_transfer IS NULL) OR (a.id_transaction IS NOT NULL AND t.id_transfer IS NOT NULL))");

        ksort($v);

        return $v;
    }

    protected function assertIntegriteFinanciere(string $contexte = ''): void
    {
        $violations = array_filter($this->integriteFinanciere());

        $this->assertSame([], $violations, trim("Règles d'intégrité violées {$contexte}") . ' : ' . json_encode($violations));
    }

    /**
     * Empreinte des dépenses de l'ancien système : leurs lignes, leurs
     * écritures au journal, et tout ce qui pourrait leur avoir été rattaché
     * depuis (nouvelle sortie, compensation, événement).
     */
    protected function empreinteHistorique(): string
    {
        $etat = [];
        foreach (['achat' => 'id_achat', 'charge' => 'id_charge'] as $t => $pk) {
            $lignes = DB::table("$t as d")->where('d.ancien_systeme', 1)->orderBy("d.$pk")
                ->get(["d.$pk as id", 'd.montant', 'd.id_transaction', 'd.statut', 'd.id_compte', 'd.date_paiement', 'd.matricule_s']);
            $ids       = $lignes->pluck('id');
            $ecritures = $lignes->pluck('id_transaction');

            $etat[$t] = [
                'nombre'        => $lignes->count(),
                'total'         => (string) $lignes->sum('montant'),
                'lignes'        => $lignes->all(),
                // Les écritures d'origine de ces dépenses, telles qu'elles sont au journal.
                'journal'       => DB::table('transaction')->whereIn('id_transaction', $ecritures)->orderBy('id_transaction')
                    ->get(['id_transaction', 'transaction_type', 'amount', 'account', 'reson', 'type_operation', 'transaction_annulee_id'])->all(),
                // Rien de nouveau ne doit leur être rattaché : ni sortie, ni compensation, ni événement.
                'nouvelles_sorties' => DB::table('transaction')->where('origine_table', $t)->whereIn('origine_id', $ids)->count(),
                'compensations'     => DB::table('transaction')->whereIn('transaction_annulee_id', $ecritures)->count(),
                'evenements'        => DB::table('depense_evenements')->where('type_depense', $t)->whereIn('id_depense', $ids)->count(),
            ];
        }

        return sha1(json_encode($etat));
    }

    /** Nombre de dépenses de l'ancien système (achats + charges). */
    protected function nombreHistoriques(): int
    {
        return DB::table('achat')->where('ancien_systeme', 1)->count() + DB::table('charge')->where('ancien_systeme', 1)->count();
    }
}
