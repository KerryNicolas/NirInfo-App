<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Tests\TestCase;

// En-tête « X-Utilisateur » : chaque réponse de l'API porte l'identifiant de
// l'utilisateur dont la session l'a produite. L'écran s'en sert pour écarter
// une réponse qui ne correspond pas au compte qu'il affiche (changement de
// compte dans un autre onglet du même navigateur).
class IdentiteDeLaReponseTest extends TestCase
{
    private User $admin;
    private User $simple;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();
        $u = $this->admin->replicate();
        $u->name = 'TEST identité'; $u->email = 'phpunit-identite@test.local'; $u->matricule = 'TEST-PHPUNIT-ID';
        $u->role_id = Role::where('slug', 'user')->firstOrFail()->id;
        $u->save();
        $this->simple = $u->fresh();
    }

    public function test_chaque_reponse_porte_l_identifiant_de_l_utilisateur_connecte(): void
    {
        foreach ([$this->admin, $this->simple] as $utilisateur) {
            foreach (['/api/user', '/api/achats', '/api/achats/export', '/api/depenses/etat', '/api/modules'] as $url) {
                $this->actingAs($utilisateur)->getJson($url)->assertOk()->assertHeader('X-Utilisateur', (string) $utilisateur->id);
            }
        }
        $this->assertNotSame($this->admin->id, $this->simple->id);
    }

    public function test_un_refus_porte_aussi_l_identifiant_pour_que_l_ecran_sache_a_qui_il_s_adresse(): void
    {
        // 403 : droit absent ; 422 et 404 : refus métier ; suppression refusée à un non-administrateur.
        $this->actingAs($this->simple)->getJson('/api/comptes-budget')->assertStatus(403)->assertHeader('X-Utilisateur', (string) $this->simple->id);
        $this->actingAs($this->simple)->getJson('/api/tresorerie/indicateurs')->assertStatus(403)->assertHeader('X-Utilisateur', (string) $this->simple->id);
        $this->actingAs($this->simple)->deleteJson('/api/achats/999999999')->assertStatus(403)->assertHeader('X-Utilisateur', (string) $this->simple->id);
        $this->actingAs($this->admin)->postJson('/api/achats', [])->assertStatus(422)->assertHeader('X-Utilisateur', (string) $this->admin->id);
        $this->actingAs($this->admin)->postJson('/api/achats/999999999/valider')->assertStatus(404)->assertHeader('X-Utilisateur', (string) $this->admin->id);
    }

    public function test_sans_session_aucun_identifiant_n_est_envoye(): void
    {
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/user')->assertStatus(401)->assertHeaderMissing('X-Utilisateur');
        $this->getJson('/api/achats')->assertStatus(401)->assertHeaderMissing('X-Utilisateur');
        $this->postJson('/api/forgot-password', [])->assertStatus(422)->assertHeaderMissing('X-Utilisateur');
    }

    public function test_le_navigateur_est_autorise_a_lire_l_en_tete_depuis_le_frontend(): void
    {
        // Le frontend et l'API ne sont pas sur le même port : sans cette autorisation
        // (Access-Control-Expose-Headers), le navigateur cache l'en-tête à l'écran.
        $origine = 'http://localhost:5173';
        $reponse = $this->actingAs($this->admin)->withHeaders(['Origin' => $origine])->getJson('/api/user')->assertOk();

        $reponse->assertHeader('Access-Control-Allow-Origin', $origine);
        $this->assertStringContainsString('X-Utilisateur', (string) $reponse->headers->get('Access-Control-Expose-Headers'));
        $reponse->assertHeader('X-Utilisateur', (string) $this->admin->id);
    }

    public function test_l_en_tete_ne_change_ni_le_corps_ni_le_statut_des_reponses(): void
    {
        $this->actingAs($this->admin)->getJson('/api/depenses/etat')->assertOk()->assertExactJson(['suivi_actif' => true]);

        $liste = $this->getJson('/api/achats?per_page=1')->assertOk()->json();
        $this->assertSame(['data', 'total', 'per_page', 'current_page', 'last_page', 'from', 'to', 'total_montant', 'total_actif'], array_keys($liste));
    }
}
