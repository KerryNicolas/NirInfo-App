<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Les achats et charges de l'ancien système ont chacun UNE sortie au journal.
// Ces règles doivent rester vraies après chaque évolution : aucune dépense
// historique ne doit être comptée deux fois, ni perdre sa référence.
class DepensesHistoriquesTest extends TestCase
{
    private const TABLES = ['achat' => 'id_achat', 'charge' => 'id_charge'];

    public function test_chaque_depense_liee_a_une_ecriture_existante_de_meme_montant(): void
    {
        foreach (self::TABLES as $table => $cle) {
            $liees = DB::table($table)->where('id_transaction', '>', 0)->count();

            $coherentes = DB::table("{$table} as d")
                ->join('transaction as t', 't.id_transaction', '=', 'd.id_transaction')
                ->where('d.id_transaction', '>', 0)
                ->where('t.transaction_type', 'S')
                ->whereRaw('t.amount = d.montant')
                ->count();

            $this->assertSame($liees, $coherentes, "{$table} : chaque ligne liée doit avoir une sortie de même montant au journal.");
        }
    }

    public function test_aucune_ecriture_n_est_utilisee_par_deux_depenses(): void
    {
        $ids = [];
        foreach (self::TABLES as $table => $cle) {
            $ids = array_merge($ids, DB::table($table)->where('id_transaction', '>', 0)->pluck('id_transaction')->all());
        }

        $this->assertSame(count($ids), count(array_unique($ids)), 'Une même écriture du journal ne doit servir qu\'à une seule dépense.');
    }

    public function test_les_depenses_historiques_sont_toujours_la(): void
    {
        // Effectifs de l'ancien système au 10/10/2026 : ils ne peuvent qu'augmenter.
        $this->assertGreaterThanOrEqual(299, DB::table('achat')->where('id_transaction', '>', 0)->count());
        $this->assertGreaterThanOrEqual(82, DB::table('charge')->where('id_transaction', '>', 0)->count());
    }
}
