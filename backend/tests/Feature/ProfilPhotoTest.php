<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

// Photo de profil : chaque compte gère la sienne, et seulement la sienne.
// Storage::fake : aucun fichier n'est écrit dans le vrai dossier de stockage.
class ProfilPhotoTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
    }

    /** Compte de test du rôle voulu, copié sur l'admin existant. */
    private function compte(string $slug, string $suffixe = ''): User
    {
        $modele = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();

        $compte = $modele->replicate();
        $compte->email     = "phpunit-{$slug}{$suffixe}@test.local";
        $compte->matricule = "TEST-PHPUNIT-{$slug}{$suffixe}";
        $compte->role_id   = Role::where('slug', $slug)->firstOrFail()->id;
        $compte->photo     = null;
        $compte->save();

        return $compte;
    }

    public static function roles(): array
    {
        return ['utilisateur simple' => ['user'], 'administrateur' => ['admin']];
    }

    /** @dataProvider roles */
    public function test_chaque_compte_peut_ajouter_sa_photo(string $slug): void
    {
        $compte = $this->compte($slug);
        $this->actingAs($compte);

        $reponse = $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('moi.jpg', 300, 300)])
            ->assertOk()
            ->assertJsonPath('message', 'Photo de profil mise à jour.');

        $chemin = $compte->fresh()->photo;
        $this->assertStringStartsWith('utilisateurs/', $chemin);
        Storage::disk('public')->assertExists($chemin);
        $this->assertSame(url('storage/' . $chemin), $reponse->json('user.photo_url'));

        // L'application retrouve la photo au chargement de la session.
        $this->getJson('/api/user')->assertOk()->assertJsonPath('photo_url', url('storage/' . $chemin));
    }

    public function test_une_nouvelle_photo_remplace_l_ancienne_et_supprime_son_fichier(): void
    {
        $compte = $this->compte('user');
        $this->actingAs($compte);

        $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('une.png')])->assertOk();
        $premiere = $compte->fresh()->photo;

        $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('deux.png')])->assertOk();
        $seconde = $compte->fresh()->photo;

        $this->assertNotSame($premiere, $seconde);
        Storage::disk('public')->assertMissing($premiere);
        Storage::disk('public')->assertExists($seconde);
    }

    public function test_la_photo_d_un_autre_compte_n_est_jamais_touchee(): void
    {
        $autre = $this->compte('user', '-autre');
        $this->actingAs($autre);
        $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('autre.jpg')])->assertOk();
        $photoAutre = $autre->fresh()->photo;

        $moi = $this->compte('user');
        $this->actingAs($moi);
        // Même en glissant l'identifiant d'un autre compte dans la requête.
        $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('moi.jpg'), 'id' => $autre->id, 'user_id' => $autre->id])->assertOk();
        $this->postJson('/api/profile/photo/retirer', ['id' => $autre->id, 'user_id' => $autre->id])->assertOk();

        $this->assertSame($photoAutre, $autre->fresh()->photo);
        Storage::disk('public')->assertExists($photoAutre);
        $this->assertNull($moi->fresh()->photo);
    }

    public function test_retirer_la_photo_vide_le_compte_et_supprime_le_fichier(): void
    {
        $compte = $this->compte('user');
        $this->actingAs($compte);
        $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('moi.webp')])->assertOk();
        $chemin = $compte->fresh()->photo;

        $this->postJson('/api/profile/photo/retirer')
            ->assertOk()
            ->assertJsonPath('user.photo_url', null);

        $this->assertNull($compte->fresh()->photo);
        Storage::disk('public')->assertMissing($chemin);

        // Sans photo, retirer à nouveau ne casse rien.
        $this->postJson('/api/profile/photo/retirer')->assertOk();
    }

    public static function fichiersRefuses(): array
    {
        return [
            'pas de fichier'  => [null],
            'un PDF'          => [['document.pdf', 100, 'application/pdf']],
            'un SVG'          => [['dessin.svg', 10, 'image/svg+xml']],
            'un script'       => [['photo.php', 10, 'application/x-php']],
            'plus de 2 Mo'    => [['grande.jpg', 2500, 'image/jpeg']],
        ];
    }

    /** @dataProvider fichiersRefuses */
    public function test_un_fichier_non_conforme_est_refuse(?array $fichier): void
    {
        $compte = $this->compte('user');
        $this->actingAs($compte);

        $donnees = $fichier ? ['photo' => UploadedFile::fake()->create(...$fichier)] : [];

        $this->postJson('/api/profile/photo', $donnees)->assertStatus(422)->assertJsonValidationErrors('photo');

        $this->assertNull($compte->fresh()->photo);
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_un_visiteur_non_connecte_est_refuse(): void
    {
        $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('moi.jpg')])->assertStatus(401);
        $this->postJson('/api/profile/photo/retirer')->assertStatus(401);

        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_modifier_le_profil_ne_touche_pas_a_la_photo(): void
    {
        $compte = $this->compte('user');
        $this->actingAs($compte);
        $this->postJson('/api/profile/photo', ['photo' => UploadedFile::fake()->image('moi.jpg')])->assertOk();
        $chemin = $compte->fresh()->photo;

        // Le chemin de la photo ne se choisit pas par le formulaire du profil.
        $this->putJson('/api/profile', ['name' => 'Nom Modifié', 'photo' => 'utilisateurs/pirate.jpg'])->assertOk();

        $this->assertSame($chemin, $compte->fresh()->photo);
        $this->assertSame('Nom Modifié', $compte->fresh()->name);
    }
}
