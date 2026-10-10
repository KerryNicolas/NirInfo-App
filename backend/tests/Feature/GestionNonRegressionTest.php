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

    public function test_la_suppression_d_une_operation_retablit_le_solde(): void
    {
        $id = $this->operation('S', 4000);

        $this->deleteJson("/api/gerer/{$id}")->assertStatus(200);

        $this->assertSame(10000.0, $this->solde());
        $this->assertSame([], $this->ecritures());
    }
}
