<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

// Schéma du suivi des dépenses (migrations 2026_10_11_*) : statuts, unicité des
// écritures, traçabilité — et compatibilité avec le code existant, qui ne
// connaît pas encore ces colonnes.
class SchemaDepensesTest extends TestCase
{
    private function achat(int $idTransaction, string $nom = 'TEST-SCHEMA'): int
    {
        return DB::table('achat')->insertGetId([
            'nom_materiel' => $nom, 'prix_unitaire' => 100, 'quantite' => 1, 'montant' => 100,
            'date_achat' => now()->toDateString(), 'photo_achat' => '', 'id_transaction' => $idTransaction,
        ], 'id_achat');
    }

    private function charge(int $idTransaction): int
    {
        return DB::table('charge')->insertGetId([
            'designation' => 'TEST-SCHEMA', 'montant' => 100, 'mois' => 1, 'annee' => 2026,
            'date' => now()->toDateString(), 'photo_charge' => '', 'id_transaction' => $idTransaction,
        ], 'id_charge');
    }

    private function ecriture(array $plus = []): int
    {
        return DB::table('transaction')->insertGetId(array_merge([
            'transaction_type' => 'S', 'amount' => 100, 'reson' => 'TEST-SCHEMA', 'account' => 0,
        ], $plus), 'id_transaction');
    }

    public function test_les_colonnes_et_la_table_existent(): void
    {
        foreach (['achat', 'charge'] as $table) {
            foreach (['statut', 'id_compte', 'valide_par', 'date_validation', 'paye_par', 'date_paiement', 'annule_par', 'date_annulation', 'motif_annulation', 'id_transaction_unique'] as $col) {
                $this->assertTrue(Schema::hasColumn($table, $col), "{$table}.{$col}");
            }
        }
        foreach (['type_operation', 'origine_table', 'origine_id', 'transaction_annulee_id', 'reference_virement', 'cree_par', 'cree_le'] as $col) {
            $this->assertTrue(Schema::hasColumn('transaction', $col), "transaction.{$col}");
        }
        foreach (['date_transfer', 'cree_par', 'id_transaction_debit', 'id_transaction_credit'] as $col) {
            $this->assertTrue(Schema::hasColumn('transfer', $col), "transfer.{$col}");
        }
        $this->assertTrue(Schema::hasTable('depense_evenements'));
    }

    public function test_une_nouvelle_depense_est_enregistree_par_defaut(): void
    {
        $this->assertSame('enregistree', DB::table('achat')->where('id_achat', $this->achat(0))->value('statut'));
        $this->assertSame('enregistree', DB::table('charge')->where('id_charge', $this->charge(0))->value('statut'));
    }

    public function test_plusieurs_depenses_sans_ecriture_sont_acceptees(): void
    {
        // id_transaction = 0 signifie « pas d'écriture » : c'est ce qu'écrit le code actuel.
        $a = $this->achat(0, 'TEST-SCHEMA 1');
        $b = $this->achat(0, 'TEST-SCHEMA 2');

        $this->assertNotSame($a, $b);
        $this->assertNull(DB::table('achat')->where('id_achat', $a)->value('id_transaction_unique'));
    }

    public function test_deux_achats_ne_peuvent_pas_partager_une_ecriture(): void
    {
        $id = $this->ecriture();
        $this->achat($id);

        $this->expectException(QueryException::class);
        $this->expectExceptionMessage('1062');
        $this->achat($id, 'TEST-SCHEMA doublon');
    }

    public function test_deux_charges_ne_peuvent_pas_partager_une_ecriture(): void
    {
        $id = $this->ecriture();
        $this->charge($id);

        $this->expectException(QueryException::class);
        $this->expectExceptionMessage('1062');
        $this->charge($id);
    }

    public function test_une_ecriture_ne_peut_etre_annulee_qu_une_fois(): void
    {
        $origine = $this->ecriture();
        $this->ecriture(['transaction_type' => 'E', 'transaction_annulee_id' => $origine]);

        $this->expectException(QueryException::class);
        $this->expectExceptionMessage('1062');
        $this->ecriture(['transaction_type' => 'E', 'transaction_annulee_id' => $origine]);
    }

    public function test_les_depenses_historiques_sont_payees_avec_le_compte_et_la_date_de_leur_ecriture(): void
    {
        foreach (['achat' => 299, 'charge' => 82] as $table => $minimum) {
            $confirmees = DB::table("{$table} as d")
                ->join('transaction as t', 't.id_transaction', '=', 'd.id_transaction')
                ->join('compte as c', 'c.id_compte', '=', 't.account')
                ->where('d.id_transaction', '>', 0)
                ->where('t.transaction_type', 'S')
                ->whereRaw('t.amount = d.montant')
                ->where('t.reson', $table);

            $this->assertGreaterThanOrEqual($minimum, (clone $confirmees)->count(), "{$table} : dépenses historiques confirmées");

            $incoherentes = (clone $confirmees)->where(function ($q) {
                $q->where('d.statut', '!=', 'payee')
                  ->orWhereRaw('d.id_compte <> t.account')
                  ->orWhereRaw('DATE(d.date_paiement) <> t.date_transaction')
                  ->orWhereNull('d.id_compte')
                  ->orWhereNull('d.date_paiement');
            })->count();

            $this->assertSame(0, $incoherentes, "{$table} : chaque dépense confirmée doit être « payee », avec le compte et la date de son écriture.");
        }
    }

    public function test_aucune_depense_payee_sans_ecriture(): void
    {
        foreach (['achat', 'charge'] as $table) {
            $this->assertSame(0, DB::table($table)->where('statut', 'payee')->where('id_transaction', '<=', 0)->count(), $table);
        }
    }

    public function test_le_code_existant_cree_toujours_achats_charges_et_virements(): void
    {
        $this->actingAs(User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail());

        $achat = $this->postJson('/api/achats', ['nom_materiel' => 'TEST-SCHEMA API', 'prix_unitaire' => 500, 'quantite' => 2, 'date_achat' => now()->toDateString()]);
        $achat->assertStatus(201);
        $ligne = DB::table('achat')->where('id_achat', $achat->json('id'))->first();
        $this->assertSame(['enregistree', 0, 1000.0], [$ligne->statut, (int) $ligne->id_transaction, (float) $ligne->montant]);

        $charge = $this->postJson('/api/charges', ['designation' => 'TEST-SCHEMA API', 'montant' => 700, 'mois' => 10, 'annee' => 2026, 'date' => now()->toDateString()]);
        $charge->assertStatus(201);
        $this->assertSame('enregistree', DB::table('charge')->where('id_charge', $charge->json('id'))->value('statut'));

        $this->getJson('/api/achats')->assertOk();
        $this->getJson('/api/charges')->assertOk();

        $a = DB::table('compte')->insertGetId(['account_number' => 'TEST-A', 'libelle' => 'TEST SCHEMA A', 'montant' => 5000], 'id_compte');
        $b = DB::table('compte')->insertGetId(['account_number' => 'TEST-B', 'libelle' => 'TEST SCHEMA B', 'montant' => 0], 'id_compte');
        $this->postJson('/api/transferts', ['starting_account' => $a, 'destination_account' => $b, 'amount' => 1200])->assertStatus(201);
        $this->assertSame([3800.0, 1200.0], [(float) DB::table('compte')->where('id_compte', $a)->value('montant'), (float) DB::table('compte')->where('id_compte', $b)->value('montant')]);
    }

    public function test_l_historique_des_actions_accepte_des_lignes(): void
    {
        $id = DB::table('depense_evenements')->insertGetId([
            'type_depense' => 'achat', 'id_depense' => 1, 'action' => 'saisie', 'statut_apres' => 'enregistree',
            'montant' => 1000, 'user_id' => null, 'created_at' => now(),
        ]);

        $this->assertSame('saisie', DB::table('depense_evenements')->where('id', $id)->value('action'));
    }
}
