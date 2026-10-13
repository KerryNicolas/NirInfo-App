<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Formateur d'une session : choisi par autocomplétion (GET /formateurs),
// enregistré à la création comme à la modification.
class SessionFormateurTest extends TestCase
{
    /** Compte de test du rôle voulu, copié sur l'admin existant. */
    private function compte(string $slug): User
    {
        $modele = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();

        $compte = $modele->replicate();
        $compte->email     = "phpunit-{$slug}@test.local";
        $compte->matricule = "TEST-PHPUNIT-{$slug}";
        $compte->role_id   = Role::where('slug', $slug)->firstOrFail()->id;
        $compte->save();

        return $compte;
    }

    /** Deux formateurs existants de la base de test. */
    private function formateurs(): array
    {
        $formateurs = DB::table('formateur')->whereNotNull('matricule_f')->orderBy('id_formateur')->limit(2)->get()->all();
        $this->assertCount(2, $formateurs, 'La base de test doit contenir au moins deux formateurs.');

        return $formateurs;
    }

    private function donnees(array $surcharge = []): array
    {
        return array_merge([
            'date_debut'      => '2099-04-01',
            'date_fin'        => '2099-04-30',
            'code_horaire'    => DB::table('horaire')->value('code_horaire'),
            'code_module'     => DB::table('module')->value('code_module'),
            'frais_formation' => 100000,
            'lieu'            => 'Ampandrana',
        ], $surcharge);
    }

    private function creer(array $surcharge = []): string
    {
        return $this->postJson('/api/sessions', $this->donnees($surcharge))->assertStatus(201)->json('code_session');
    }

    private function matriculeF(string $code): ?string
    {
        return DB::table('session')->where('code_session', $code)->value('matricule_f');
    }

    public static function roles(): array
    {
        return ['utilisateur simple' => ['user'], 'administrateur' => ['admin']];
    }

    /** @dataProvider roles */
    public function test_la_liste_ne_renvoie_que_l_id_le_matricule_le_nom_et_le_prenom(string $slug): void
    {
        $this->actingAs($this->compte($slug));

        $liste = $this->getJson('/api/formateurs')->assertOk()->json();

        $this->assertCount(DB::table('formateur')->count(), $liste);
        foreach ($liste as $formateur) {
            $this->assertSame(['id', 'matricule', 'nom', 'prenom'], array_keys($formateur));
            $this->assertSame(DB::table('formateur')->where('id_formateur', $formateur['id'])->value('matricule_f'), $formateur['matricule']);
        }
    }

    public function test_la_liste_est_refusee_sans_connexion(): void
    {
        $this->getJson('/api/formateurs')->assertStatus(401);
    }

    public function test_la_creation_enregistre_le_formateur_choisi(): void
    {
        $this->actingAs($this->compte('user'));
        [$formateur] = $this->formateurs();

        $code = $this->creer(['id_formateur' => $formateur->id_formateur]);

        $this->assertSame($formateur->matricule_f, $this->matriculeF($code));

        // La liste des sessions renvoie l'identifiant : le formulaire le préremplit.
        $ligne = collect($this->getJson('/api/sessions?search=' . urlencode($code))->assertOk()->json('data'))
            ->firstWhere('code_session', $code);
        $this->assertSame($formateur->id_formateur, (int) $ligne['id_formateur']);
    }

    public function test_la_creation_sans_formateur_reste_possible(): void
    {
        $this->actingAs($this->compte('user'));

        $this->assertNull($this->matriculeF($this->creer()));
        $this->assertNull($this->matriculeF($this->creer(['date_debut' => '2099-05-01', 'id_formateur' => null])));
    }

    public function test_un_formateur_inexistant_est_refuse(): void
    {
        $this->actingAs($this->compte('user'));
        $inconnu = (int) DB::table('formateur')->max('id_formateur') + 1000;

        $this->postJson('/api/sessions', $this->donnees(['id_formateur' => $inconnu]))
            ->assertStatus(422)->assertJsonValidationErrors('id_formateur');
        $this->assertFalse(DB::table('session')->where('debut_session', '2099-04-01')->exists());

        [$formateur] = $this->formateurs();
        $code = $this->creer(['id_formateur' => $formateur->id_formateur]);

        $this->putJson('/api/sessions/' . rawurlencode($code), ['id_formateur' => $inconnu])
            ->assertStatus(422)->assertJsonValidationErrors('id_formateur');
        $this->assertSame($formateur->matricule_f, $this->matriculeF($code));
    }

    public function test_la_modification_change_retire_ou_conserve_le_formateur(): void
    {
        $this->actingAs($this->compte('user'));
        [$premier, $second] = $this->formateurs();
        $code = $this->creer(['id_formateur' => $premier->id_formateur]);
        $url  = '/api/sessions/' . rawurlencode($code);

        // Champ absent : le formateur enregistré n'est pas touché.
        $this->putJson($url, ['frais_formation' => 120000])->assertOk();
        $this->assertSame($premier->matricule_f, $this->matriculeF($code));
        $this->assertSame(120000, (int) DB::table('session')->where('code_session', $code)->value('frais_module'));

        $this->putJson($url, ['id_formateur' => $second->id_formateur])->assertOk();
        $this->assertSame($second->matricule_f, $this->matriculeF($code));

        // Champ envoyé vide : la session n'a plus de formateur.
        $this->putJson($url, ['id_formateur' => null])->assertOk();
        $this->assertNull($this->matriculeF($code));
    }
}
