<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

// Droits du suivi des dépenses : qui peut saisir, valider, payer, annuler.
class DepensePermissionsTest extends TestCase
{
    private User $admin;
    private User $simple;
    private int $compte;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();

        // Compte simple de test (annulé à la fin, comme tout le reste).
        $this->simple = $this->admin->replicate();
        $this->simple->email     = 'phpunit-depenses@test.local';
        $this->simple->matricule = 'TEST-PHPUNIT-DEP';
        $this->simple->role_id   = Role::where('slug', 'user')->firstOrFail()->id;
        $this->simple->save();

        $this->compte = DB::table('compte')->insertGetId(['account_number' => 'TEST-DP', 'libelle' => 'TEST DROITS', 'montant' => 50000], 'id_compte');
    }

    private function creerAchat(User $auteur): int
    {
        return (int) $this->actingAs($auteur)->postJson('/api/achats', [
            'nom_materiel' => 'TEST-DROITS', 'prix_unitaire' => 1000, 'quantite' => 2, 'date_achat' => now()->toDateString(),
        ])->assertStatus(201)->json('id');
    }

    private function statut(int $id): string
    {
        return DB::table('achat')->where('id_achat', $id)->value('statut');
    }

    public function test_les_deux_permissions_sont_attribuees_au_seul_role_admin(): void
    {
        foreach (['depenses.valider', 'depenses.payer'] as $slug) {
            $this->assertTrue($this->admin->hasPermission($slug), "admin : {$slug}");
            $this->assertFalse($this->simple->hasPermission($slug), "utilisateur simple : {$slug}");
        }
    }

    public function test_les_dix_routes_existent_avec_leur_protection(): void
    {
        $attendu = [
            'valider'          => ['POST', 'permission:depenses.valider'],
            'payer'            => ['POST', 'permission:depenses.payer'],
            'annuler-paiement' => ['POST', 'permission:depenses.payer'],
            'annuler'          => ['POST', 'permission:logistique.access'],
            'historique'       => ['GET',  'permission:logistique.access'],
        ];

        foreach (['achats', 'charges'] as $prefixe) {
            foreach ($attendu as $action => [$methode, $permission]) {
                $route = collect(Route::getRoutes())->first(
                    fn ($r) => $r->uri() === "api/{$prefixe}/{id}/{$action}" && in_array($methode, $r->methods(), true)
                );

                $this->assertNotNull($route, "{$methode} api/{$prefixe}/{id}/{$action}");
                $this->assertContains('auth:sanctum', $route->gatherMiddleware(), "{$prefixe}/{$action} : connexion obligatoire");
                $this->assertContains($permission, $route->gatherMiddleware(), "{$prefixe}/{$action} : {$permission}");
            }
        }
    }

    public function test_sans_connexion_tout_est_refuse(): void
    {
        $this->postJson('/api/achats/1/valider')->assertStatus(401);
        $this->postJson('/api/achats/1/payer', ['id_compte' => $this->compte])->assertStatus(401);
        $this->postJson('/api/charges/1/annuler-paiement', ['motif' => 'x'])->assertStatus(401);
        $this->getJson('/api/achats/1/historique')->assertStatus(401);
    }

    public function test_l_utilisateur_simple_saisit_mais_ne_valide_ni_ne_paie(): void
    {
        $id = $this->creerAchat($this->simple);
        $this->assertSame('enregistree', $this->statut($id));

        // Ce qu'il peut faire : modifier sa saisie, consulter l'historique.
        $this->putJson("/api/achats/{$id}", ['nom_materiel' => 'TEST-DROITS corrigé', 'prix_unitaire' => 1000, 'quantite' => 2, 'date_achat' => now()->toDateString()])->assertStatus(200);
        $this->getJson("/api/achats/{$id}/historique")->assertOk()->assertJsonCount(1, 'data');

        // Ce qui lui est refusé.
        $this->postJson("/api/achats/{$id}/valider")->assertStatus(403);
        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compte])->assertStatus(403);
        $this->deleteJson("/api/achats/{$id}")->assertStatus(403);
        $this->assertSame('enregistree', $this->statut($id));

        // Même une fois la dépense validée puis payée par l'admin.
        $this->actingAs($this->admin)->postJson("/api/achats/{$id}/valider")->assertStatus(200);
        $this->actingAs($this->simple)->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compte])->assertStatus(403);
        $this->actingAs($this->admin)->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compte])->assertStatus(200);
        $this->actingAs($this->simple)->postJson("/api/achats/{$id}/annuler-paiement", ['motif' => 'tentative'])->assertStatus(403);

        $this->assertSame('payee', $this->statut($id));
        $this->assertSame(48000.0, (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant'));
    }

    public function test_l_utilisateur_simple_annule_sa_propre_depense_non_payee(): void
    {
        $id = $this->creerAchat($this->simple);

        $this->postJson("/api/achats/{$id}/annuler", ['motif' => 'Saisie en double'])->assertStatus(200);

        $a = DB::table('achat')->where('id_achat', $id)->first();
        $this->assertSame(['annulee', $this->simple->id, 'Saisie en double'], [$a->statut, (int) $a->annule_par, $a->motif_annulation]);
    }

    public function test_l_utilisateur_simple_ne_peut_pas_annuler_la_depense_d_un_autre(): void
    {
        $id = $this->creerAchat($this->admin);

        $this->actingAs($this->simple)->postJson("/api/achats/{$id}/annuler", ['motif' => 'tentative'])
            ->assertStatus(403)->assertJsonPath('message', "Seul l'administrateur ou l'auteur de la saisie peut annuler cette dépense.");

        $this->assertSame('enregistree', $this->statut($id));
    }

    public function test_l_administrateur_peut_tout_faire_y_compris_annuler_la_depense_d_un_autre(): void
    {
        $id = $this->creerAchat($this->simple);

        $this->actingAs($this->admin);
        $this->postJson("/api/achats/{$id}/valider")->assertStatus(200);
        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compte])->assertStatus(200);
        $this->postJson("/api/achats/{$id}/annuler-paiement", ['motif' => 'Contrôle'])->assertStatus(200);
        $this->postJson("/api/achats/{$id}/annuler", ['motif' => 'Abandon'])->assertStatus(200);

        $this->assertSame('annulee', $this->statut($id));
        $this->assertSame(50000.0, (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant'));
    }
}
