<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Lieux de formation et de paiement : la liste n'est plus écrite en dur, elle
// se gère depuis l'onglet « Lieu » de Session.
class LieuTest extends TestCase
{
    private const NOM = 'Test Phpunit Lieu';

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

    private function idLieu(string $nom): ?int
    {
        return DB::table('lieu')->where('nom_lieu', $nom)->value('id_lieu');
    }

    public function test_les_trois_lieux_d_origine_sont_dans_la_liste(): void
    {
        $this->actingAs($this->compte('user'));

        $noms = array_column($this->getJson('/api/lieux?per_page=200')->assertOk()->json('data'), 'nom');

        foreach (['Ampandrana', 'Ampefiloha', 'Andravoahangy'] as $lieu) {
            $this->assertContains($lieu, $noms);
        }
    }

    public static function roles(): array
    {
        return ['utilisateur simple' => ['user'], 'administrateur' => ['admin']];
    }

    /** @dataProvider roles */
    public function test_chaque_compte_peut_creer_un_lieu(string $slug): void
    {
        $compte = $this->compte($slug);
        $this->actingAs($compte);

        // Espaces superflus et casse : le nom est remis en forme.
        $this->postJson('/api/lieux', ['nom' => '  test   PHPUNIT lieu '])->assertStatus(201);

        $lieu = DB::table('lieu')->where('nom_lieu', self::NOM)->first();
        $this->assertNotNull($lieu);
        $this->assertSame(self::NOM, $lieu->nom_lieu);
        $this->assertSame($compte->matricule, $lieu->matricule_s);

        $trouve = $this->getJson('/api/lieux?search=Phpunit')->assertOk()->json();
        $this->assertSame(1, $trouve['total']);
        $this->assertSame(self::NOM, $trouve['data'][0]['nom']);
    }

    public function test_un_doublon_ou_un_nom_vide_est_refuse(): void
    {
        $this->actingAs($this->compte('user'));
        $avant = DB::table('lieu')->count();

        $this->postJson('/api/lieux', ['nom' => 'AMPANDRANA'])->assertStatus(422)->assertJsonValidationErrors('nom');
        $this->postJson('/api/lieux', ['nom' => '   '])->assertStatus(422)->assertJsonValidationErrors('nom');
        $this->postJson('/api/lieux', [])->assertStatus(422)->assertJsonValidationErrors('nom');
        $this->postJson('/api/lieux', ['nom' => str_repeat('a', 101)])->assertStatus(422);

        $this->assertSame($avant, DB::table('lieu')->count());
    }

    public function test_renommer_un_lieu_suit_dans_les_sessions_les_paiements_et_les_certificats(): void
    {
        $this->actingAs($this->compte('user'));
        $this->postJson('/api/lieux', ['nom' => self::NOM])->assertStatus(201);

        // Une session, un paiement et un certificat existants portent ce lieu.
        $session     = DB::table('session')->orderByDesc('id')->value('id');
        $inscription = DB::table('inscription')->orderByDesc('id_paiement')->value('id_paiement');
        $certificat  = DB::table('certificat')->orderByDesc('id')->value('id');
        DB::table('session')->where('id', $session)->update(['lieu' => self::NOM]);
        DB::table('inscription')->where('id_paiement', $inscription)->update(['lieu_paiement' => self::NOM]);
        DB::table('certificat')->where('id', $certificat)->update(['lieu_paiement' => self::NOM]);
        $autresSessions = DB::table('session')->where('id', '!=', $session)->where('lieu', 'Ampefiloha')->count();

        $this->putJson('/api/lieux/' . $this->idLieu(self::NOM), ['nom' => 'Test Phpunit Renommé'])
            ->assertOk()->assertJsonPath('nom', 'Test Phpunit Renommé');

        $this->assertNull($this->idLieu(self::NOM));
        $this->assertSame('Test Phpunit Renommé', DB::table('session')->where('id', $session)->value('lieu'));
        $this->assertSame('Test Phpunit Renommé', DB::table('inscription')->where('id_paiement', $inscription)->value('lieu_paiement'));
        $this->assertSame('Test Phpunit Renommé', DB::table('certificat')->where('id', $certificat)->value('lieu_paiement'));
        // Les autres lieux ne bougent pas.
        $this->assertSame($autresSessions, DB::table('session')->where('id', '!=', $session)->where('lieu', 'Ampefiloha')->count());
    }

    public function test_renommer_vers_un_nom_deja_pris_est_refuse(): void
    {
        $this->actingAs($this->compte('user'));
        $this->postJson('/api/lieux', ['nom' => self::NOM])->assertStatus(201);
        $id = $this->idLieu(self::NOM);

        $this->putJson("/api/lieux/{$id}", ['nom' => 'ampefiloha'])->assertStatus(422)->assertJsonValidationErrors('nom');
        $this->assertSame(self::NOM, DB::table('lieu')->where('id_lieu', $id)->value('nom_lieu'));

        // Réenregistrer le même nom n'est pas un doublon.
        $this->putJson("/api/lieux/{$id}", ['nom' => self::NOM])->assertOk();
        $this->putJson('/api/lieux/999999999', ['nom' => 'Inconnu'])->assertStatus(404);
    }

    public function test_la_suppression_est_reservee_a_l_administrateur(): void
    {
        $this->actingAs($this->compte('user'));
        $this->postJson('/api/lieux', ['nom' => self::NOM])->assertStatus(201);
        $id = $this->idLieu(self::NOM);

        $this->deleteJson("/api/lieux/{$id}")->assertStatus(403);
        $this->assertNotNull($this->idLieu(self::NOM));

        $this->actingAs($this->compte('admin'));
        $this->deleteJson("/api/lieux/{$id}")->assertOk();
        $this->assertNull($this->idLieu(self::NOM));
        $this->deleteJson("/api/lieux/{$id}")->assertStatus(404);
    }

    public function test_un_lieu_utilise_ne_se_supprime_pas(): void
    {
        $this->actingAs($this->compte('admin'));
        $this->postJson('/api/lieux', ['nom' => self::NOM])->assertStatus(201);
        $id = $this->idLieu(self::NOM);
        DB::table('session')->where('id', DB::table('session')->orderByDesc('id')->value('id'))->update(['lieu' => self::NOM]);

        $message = $this->deleteJson("/api/lieux/{$id}")->assertStatus(422)->json('message');

        $this->assertStringContainsString('1 session(s)', $message);
        $this->assertNotNull($this->idLieu(self::NOM));

        // Un lieu d'origine, porté par des milliers de paiements, est protégé de la même façon.
        $this->deleteJson('/api/lieux/' . $this->idLieu('Ampefiloha'))->assertStatus(422);
        $this->assertNotNull($this->idLieu('Ampefiloha'));
    }

    public function test_un_visiteur_non_connecte_est_refuse(): void
    {
        $this->getJson('/api/lieux')->assertStatus(401);
        $this->postJson('/api/lieux', ['nom' => self::NOM])->assertStatus(401);
        $this->assertNull($this->idLieu(self::NOM));
    }

    public function test_une_session_s_enregistre_avec_un_lieu_nouvellement_cree(): void
    {
        $this->actingAs($this->compte('user'));
        $this->postJson('/api/lieux', ['nom' => self::NOM])->assertStatus(201);

        $session = DB::table('session')->orderByDesc('id')->first();
        $this->putJson('/api/sessions/' . $session->code_session, [
            'date_debut' => $session->debut_session, 'date_fin' => $session->fin_session,
            'date_echeance' => $session->echeance, 'code_horaire' => $session->code_horaire,
            'code_module' => $session->code_module, 'frais_formation' => $session->frais_module,
            'lieu' => self::NOM,
        ])->assertOk();

        $this->assertSame(self::NOM, DB::table('session')->where('id', $session->id)->value('lieu'));
    }
}
