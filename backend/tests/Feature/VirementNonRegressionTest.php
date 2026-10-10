<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Non-régression des virements entre comptes (TransferController) : soldes des
// deux comptes après création, modification et suppression.
class VirementNonRegressionTest extends TestCase
{
    private int $a;
    private int $b;
    private int $c;

    protected function setUp(): void
    {
        parent::setUp();

        $this->a = DB::table('compte')->insertGetId(['account_number' => 'TEST-VA', 'libelle' => 'TEST VIREMENT A', 'montant' => 10000], 'id_compte');
        $this->b = DB::table('compte')->insertGetId(['account_number' => 'TEST-VB', 'libelle' => 'TEST VIREMENT B', 'montant' => 2000], 'id_compte');
        $this->c = DB::table('compte')->insertGetId(['account_number' => 'TEST-VC', 'libelle' => 'TEST VIREMENT C', 'montant' => 0], 'id_compte');

        $this->actingAs(User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail());
    }

    private function soldes(): array
    {
        return array_map(
            fn ($id) => (float) DB::table('compte')->where('id_compte', $id)->value('montant'),
            [$this->a, $this->b, $this->c]
        );
    }

    private function virer(int $de, int $vers, int $montant): int
    {
        $this->postJson('/api/transferts', ['starting_account' => $de, 'destination_account' => $vers, 'amount' => $montant])->assertStatus(201);

        return (int) DB::table('transfer')->max('id_transfer');
    }

    public function test_creation_d_un_virement(): void
    {
        $this->virer($this->a, $this->b, 3000);

        $this->assertSame([7000.0, 5000.0, 0.0], $this->soldes());
    }

    public function test_modification_du_montant_et_du_compte_de_destination(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);

        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 4500])->assertStatus(200);
        $this->assertSame([5500.0, 6500.0, 0.0], $this->soldes());

        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->c, 'amount' => 1000])->assertStatus(200);
        $this->assertSame([9000.0, 2000.0, 1000.0], $this->soldes());
    }

    public function test_suppression_d_un_virement(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);

        $this->deleteJson("/api/transferts/{$id}")->assertStatus(200);

        $this->assertSame([10000.0, 2000.0, 0.0], $this->soldes());
        $this->assertSame(0, DB::table('transfer')->where('id_transfer', $id)->count());
    }

    public function test_virement_refuse_si_solde_insuffisant(): void
    {
        $avant = DB::table('transfer')->count();

        $this->postJson('/api/transferts', ['starting_account' => $this->c, 'destination_account' => $this->a, 'amount' => 500])->assertStatus(422);

        $this->assertSame([10000.0, 2000.0, 0.0], $this->soldes());
        $this->assertSame($avant, DB::table('transfer')->count());
    }

    public function test_les_vrais_comptes_ne_sont_pas_touches(): void
    {
        $tests = [$this->a, $this->b, $this->c];
        $avant = DB::table('compte')->whereNotIn('id_compte', $tests)->orderBy('id_compte')->pluck('montant', 'id_compte')->all();

        $id = $this->virer($this->a, $this->b, 3000);
        $this->deleteJson("/api/transferts/{$id}");

        $this->assertSame($avant, DB::table('compte')->whereNotIn('id_compte', $tests)->orderBy('id_compte')->pluck('montant', 'id_compte')->all());
    }
}
