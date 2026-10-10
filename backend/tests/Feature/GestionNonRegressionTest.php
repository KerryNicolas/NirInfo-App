<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Non-régression des opérations manuelles de l'onglet Gestion (GererController) :
// dépôts et retraits, avec leur effet sur le solde et sur le journal.
class GestionNonRegressionTest extends TestCase
{
    private int $compte;
    private int $dernierIdJournal;

    protected function setUp(): void
    {
        parent::setUp();

        $this->compte = DB::table('compte')->insertGetId(['account_number' => 'TEST-G', 'libelle' => 'TEST GESTION', 'montant' => 10000], 'id_compte');
        $this->actingAs(User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail());
        $this->dernierIdJournal = (int) DB::table('transaction')->max('id_transaction');
    }

    private function solde(): float
    {
        return (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant');
    }

    private function operation(string $type, int $montant, string $raison = 'TEST opération manuelle'): int
    {
        $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => $type, 'montant' => $montant, 'raison' => $raison])->assertStatus(201);

        return (int) DB::table('transaction')->max('id_transaction');
    }

    private function ecritures(): array
    {
        return DB::table('transaction')->where('id_transaction', '>', $this->dernierIdJournal)->orderBy('id_transaction')->get()
            ->map(fn ($t) => [$t->transaction_type, (int) $t->amount, (int) $t->account, $t->reson])->all();
    }

    public function test_un_depot_credite_le_compte(): void
    {
        $this->operation('E', 2500);

        $this->assertSame(12500.0, $this->solde());
        $this->assertSame([['E', 2500, $this->compte, 'TEST opération manuelle']], $this->ecritures());
    }

    public function test_un_retrait_debite_le_compte(): void
    {
        $this->operation('S', 4000);

        $this->assertSame(6000.0, $this->solde());
        $this->assertSame([['S', 4000, $this->compte, 'TEST opération manuelle']], $this->ecritures());
    }

    public function test_un_retrait_superieur_au_solde_est_refuse(): void
    {
        $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => 'S', 'montant' => 10001, 'raison' => 'TEST'])->assertStatus(422);

        $this->assertSame(10000.0, $this->solde());
        $this->assertSame([], $this->ecritures());
    }

    public function test_la_modification_d_une_operation_recalcule_le_solde(): void
    {
        $id = $this->operation('E', 2500);

        $this->putJson("/api/gerer/{$id}", ['compte' => $this->compte, 'type' => 'S', 'montant' => 1000, 'raison' => 'TEST modifiée'])->assertStatus(200);

        $this->assertSame(9000.0, $this->solde());
        $this->assertSame([['S', 1000, $this->compte, 'TEST modifiée']], $this->ecritures());
    }

    public function test_les_motifs_reserves_sont_refuses(): void
    {
        // Motifs que l'application génère elle-même, et que la liste de la
        // Gestion masque : saisis à la main, ils rendraient l'opération invisible.
        $reserves = [
            'achat', 'charge', 'inscription', 'recouvrement', 'prestation', 'recouvrement_prestation', 'certificat',
            'ACHAT', ' Achat ', 'Charge', "inscription\t",              // casse et espaces autour
            'Certification CERT-2026-0001', 'certification', 'correction inscription #12',
            'Correction Recouvrement #7', 'suppression inscription #6644', 'suppression recouvrement #1',
        ];

        foreach ($reserves as $motif) {
            foreach (['E', 'S'] as $type) {
                $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => $type, 'montant' => 100, 'raison' => $motif])
                    ->assertStatus(422, "« {$motif} » ({$type}) aurait dû être refusé.");
            }
        }

        $this->assertSame(10000.0, $this->solde());
        $this->assertSame([], $this->ecritures());
    }

    public function test_les_motifs_libres_restent_acceptes(): void
    {
        // Y compris ceux qui CONTIENNENT un mot réservé : seule la correspondance exacte est refusée.
        $libres = ['Achat de balais et de rasta', 'Achat farilac (2 pcs)', 'Paiement salaire', 'frais Mr Edmond',
                   "Frais d'inscription au salon", 'charges diverses', 'achats', 'Dépot admin'];

        foreach ($libres as $motif) {
            $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => 'E', 'montant' => 100, 'raison' => $motif])
                ->assertStatus(201, "« {$motif} » aurait dû être accepté.");
        }

        $this->assertSame(10000.0 + 100 * count($libres), $this->solde());
        $this->assertSame($libres, array_column($this->ecritures(), 3));
    }

    public function test_une_operation_ne_peut_pas_prendre_un_motif_reserve_a_la_modification(): void
    {
        $id = $this->operation('E', 2500);

        $this->putJson("/api/gerer/{$id}", ['compte' => $this->compte, 'type' => 'E', 'montant' => 2500, 'raison' => 'achat'])->assertStatus(422);
        $this->putJson("/api/gerer/{$id}", ['compte' => $this->compte, 'type' => 'E', 'montant' => 2500, 'raison' => ' Inscription '])->assertStatus(422);

        $this->assertSame([['E', 2500, $this->compte, 'TEST opération manuelle']], $this->ecritures(), "L'opération ne doit pas avoir changé.");
        $this->assertSame(12500.0, $this->solde());
    }

    public function test_un_compte_portant_une_operation_ne_se_supprime_pas(): void
    {
        $id = $this->operation('E', 2500);

        $this->deleteJson("/api/comptes-budget/{$this->compte}")
            ->assertStatus(422)->assertJsonPath('message', 'Ce compte est utilisé par des opérations financières : il ne peut pas être supprimé.');
        $this->assertSame(1, DB::table('compte')->where('id_compte', $this->compte)->count());

        // Une fois l'opération supprimée, le compte n'a plus d'écriture : il redevient supprimable.
        $this->deleteJson("/api/gerer/{$id}")->assertStatus(200);
        $this->deleteJson("/api/comptes-budget/{$this->compte}")->assertStatus(200);
        $this->assertSame(0, DB::table('compte')->where('id_compte', $this->compte)->count());
    }

    public function test_la_suppression_d_une_operation_retablit_le_solde(): void
    {
        $id = $this->operation('S', 4000);

        $this->deleteJson("/api/gerer/{$id}")->assertStatus(200);

        $this->assertSame(10000.0, $this->solde());
        $this->assertSame([], $this->ecritures());
    }
}
