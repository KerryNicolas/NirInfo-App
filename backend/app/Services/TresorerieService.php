<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Service de trésorerie — point unique d'écriture « solde + journal ».
 *
 * Reprend à l'identique la logique qui se trouvait dans
 * BaseApiController::ajusterSoldeCompte() (mêmes tables, mêmes champs, même
 * ordre), avec deux ajouts :
 *  - le compte est verrouillé le temps de l'opération : deux mouvements
 *    simultanés sur le même compte passent l'un après l'autre ;
 *  - le numéro EXACT de l'écriture créée est renvoyé (jamais « le dernier
 *    numéro de la table », qui peut appartenir à un autre utilisateur).
 */
class TresorerieService
{
    /** Colonnes de traçabilité du journal (migration 2026_10_11_000002). */
    private const TRACE = ['type_operation', 'origine_table', 'origine_id', 'transaction_annulee_id', 'reference_virement', 'cree_par'];

    /**
     * Enregistre un mouvement : solde du compte, journal `transaction` et
     * `gestion_compte`, dans une seule transaction SQL (tout ou rien).
     *
     * @param  int     $idCompte
     * @param  float   $montant
     * @param  string  $sens     'E' (entrée, +) ou 'S' (sortie, -)
     * @param  string  $raison   texte journalisé dans transaction.reson
     * @param  array   $trace    FACULTATIF — traçabilité de l'écriture (colonnes
     *                           TRACE ci-dessous). Sans lui, l'écriture est
     *                           strictement celle d'avant : les appels existants
     *                           (inscriptions, recouvrements) ne le passent pas,
     *                           et aucune des nouvelles colonnes n'est touchée.
     * @return int     id_transaction de l'écriture créée
     */
    public function mouvement(int $idCompte, float $montant, string $sens, string $raison, array $trace = []): int
    {
        return DB::transaction(function () use ($idCompte, $montant, $sens, $raison, $trace) {
            // Verrou sur la ligne du compte jusqu'à la fin de la transaction.
            // Un compte inexistant ne lève pas d'erreur, comme avant : certains
            // anciens paiements portent un libellé (« Mobile Money ») au lieu
            // d'un numéro de compte, et doivent rester modifiables.
            DB::table('compte')->where('id_compte', $idCompte)->lockForUpdate()->first();

            if ($sens === 'E') {
                DB::table('compte')->where('id_compte', $idCompte)->increment('montant', $montant);
            } else {
                DB::table('compte')->where('id_compte', $idCompte)->decrement('montant', $montant);
            }

            $ecriture = [
                'transaction_type' => $sens,
                'amount'           => $montant,
                'reson'            => $raison,
                'account'          => $idCompte,
                'date_transaction' => now()->toDateString(),
            ];

            // Traçabilité : seules les colonnes prévues sont acceptées, et
            // l'horodatage est posé ici, jamais par l'appelant.
            if ($trace !== []) {
                $ecriture += array_intersect_key($trace, array_flip(self::TRACE)) + ['cree_le' => now()];
            }

            $idTransaction = DB::table('transaction')->insertGetId($ecriture);

            DB::table('gestion_compte')->insert([
                'id_compte'      => $idCompte,
                'type'           => $sens,
                'montant'        => $montant,
                'date_gestion'   => now()->toDateString(),
                'id_transaction' => $idTransaction,
            ]);

            return (int) $idTransaction;
        });
    }
}
