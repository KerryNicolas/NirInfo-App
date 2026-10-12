<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Confidentialité des salaires du personnel : seuls les administrateurs (admin
// et administrateur principal) les reçoivent et les modifient. L'utilisateur
// simple garde tout le reste du module : liste, fiche, création, modification.
class PersonnelSalaireTest extends TestCase
{
    private const BAS  = 'TEST-PHPUNIT-P1';   // petit salaire
    private const HAUT = 'TEST-PHPUNIT-P2';   // gros salaire

    private int $fonction;

    protected function setUp(): void
    {
        parent::setUp();

        // Rôle super-admin (annulé à la fin, comme tout le reste).
        $this->seed(RolePermissionSeeder::class);

        $this->fonction = DB::table('fonction')->insertGetId(['nom_fonction' => 'TEST PHPUNIT', 'description_fonction' => '']);
        $this->personnel(self::BAS, 111111);
        $this->personnel(self::HAUT, 999999);
    }

    private function personnel(string $matricule, int $salaire): void
    {
        DB::table('personnel')->insert([
            'matricule_pers' => $matricule, 'nom_pers' => 'TEST', 'prenom_pers' => 'Phpunit',
            'ldn_pers' => '', 'cin_pers' => '', 'lcin_pers' => '', 'tel_pers' => '', 'email_pers' => '',
            'salaire_pers' => $salaire, 'diplome_pers' => '', 'adresse_pers' => '',
            'id_fonction' => $this->fonction, 'photo_pers' => '',
        ]);
    }

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

    private function liste(array $parametres = []): array
    {
        return $this->getJson('/api/personnel?' . http_build_query(['search' => 'TEST-PHPUNIT-P', 'per_page' => 50] + $parametres))
            ->assertOk()->json('data');
    }

    private function salaireEnBase(string $matricule): int
    {
        return (int) DB::table('personnel')->where('matricule_pers', $matricule)->value('salaire_pers');
    }

    private function fiche(array $champs = []): array
    {
        return ['nom_pers' => 'TEST', 'prenom_pers' => 'Modifié', 'id_fonction' => $this->fonction] + $champs;
    }

    public static function administrateurs(): array
    {
        return ['admin' => ['admin'], 'administrateur principal' => ['super-admin']];
    }

    /* ── Lecture ── */

    public function test_l_utilisateur_simple_ne_recoit_aucun_salaire_dans_la_liste(): void
    {
        $this->actingAs($this->compte('user'));

        $lignes = $this->liste();
        $this->assertCount(2, $lignes);                       // il garde l'accès à la liste…
        foreach ($lignes as $ligne) {
            $this->assertArrayNotHasKey('salaire_pers', $ligne);   // …sans le salaire, sur aucune ligne
            $this->assertSame('TEST', $ligne['nom_pers']);         // le reste de la fiche est toujours là
        }

        // Aucun des deux montants n'apparaît où que ce soit dans la réponse.
        $brut = $this->getJson('/api/personnel?search=TEST-PHPUNIT-P')->getContent();
        $this->assertStringNotContainsString('111111', $brut);
        $this->assertStringNotContainsString('999999', $brut);
    }

    public function test_l_utilisateur_simple_ne_recoit_aucun_salaire_dans_la_fiche(): void
    {
        $this->actingAs($this->compte('user'));

        $this->getJson('/api/personnel/' . self::HAUT)->assertOk()
            ->assertJsonPath('matricule_pers', self::HAUT)
            ->assertJsonMissingPath('salaire_pers');
    }

    public function test_l_utilisateur_simple_ne_peut_pas_trier_par_salaire(): void
    {
        $this->actingAs($this->compte('user'));

        // Quel que soit le sens demandé, l'ordre est celui de la liste habituelle :
        // le tri par salaire est ignoré, il ne révèle donc pas qui gagne le plus.
        $habituel = array_column($this->liste(), 'matricule_pers');
        foreach (['p.salaire_pers', 'salaire_pers', 'P.SALAIRE_PERS'] as $tri) {
            foreach (['asc', 'desc'] as $sens) {
                $this->assertSame($habituel, array_column($this->liste(['sort' => $tri, 'sort_dir' => $sens]), 'matricule_pers'), "tri {$tri} {$sens}");
            }
        }
    }

    /** @dataProvider administrateurs */
    public function test_les_administrateurs_recoivent_les_salaires(string $slug): void
    {
        $this->actingAs($this->compte($slug));

        $salaires = array_column($this->liste(), 'salaire_pers', 'matricule_pers');
        $this->assertSame(111111, (int) $salaires[self::BAS]);
        $this->assertSame(999999, (int) $salaires[self::HAUT]);

        $this->assertSame(999999, (int) $this->getJson('/api/personnel/' . self::HAUT)->assertOk()->json('salaire_pers'));

        // Le tri par salaire reste disponible pour eux.
        $this->assertSame([self::BAS, self::HAUT], array_column($this->liste(['sort' => 'p.salaire_pers', 'sort_dir' => 'asc']), 'matricule_pers'));
        $this->assertSame([self::HAUT, self::BAS], array_column($this->liste(['sort' => 'p.salaire_pers', 'sort_dir' => 'desc']), 'matricule_pers'));
    }

    /* ── Écriture ── */

    public function test_la_modification_par_l_utilisateur_simple_ne_touche_pas_au_salaire(): void
    {
        $this->actingAs($this->compte('user'));

        // Sans salaire dans la requête (ce que l'écran envoie) : il n'est pas remis à zéro.
        $this->putJson('/api/personnel/' . self::HAUT, $this->fiche())->assertOk();
        $this->assertSame(999999, $this->salaireEnBase(self::HAUT));
        $this->assertSame('Modifié', DB::table('personnel')->where('matricule_pers', self::HAUT)->value('prenom_pers'));   // il garde le droit de modifier le reste

        // Avec un salaire glissé dans la requête : il est ignoré.
        $this->putJson('/api/personnel/' . self::HAUT, $this->fiche(['salaire_pers' => 5]))->assertOk();
        $this->assertSame(999999, $this->salaireEnBase(self::HAUT));
    }

    public function test_la_creation_par_l_utilisateur_simple_ne_fixe_aucun_salaire(): void
    {
        $this->actingAs($this->compte('user'));

        $this->postJson('/api/personnel', $this->fiche(['matricule_pers' => 'TEST-PHPUNIT-P3', 'salaire_pers' => 777777]))->assertCreated();
        $this->assertSame(0, $this->salaireEnBase('TEST-PHPUNIT-P3'));
    }

    /** @dataProvider administrateurs */
    public function test_les_administrateurs_creent_et_modifient_les_salaires(string $slug): void
    {
        $this->actingAs($this->compte($slug));

        $this->putJson('/api/personnel/' . self::BAS, $this->fiche(['salaire_pers' => 250000]))->assertOk();
        $this->assertSame(250000, $this->salaireEnBase(self::BAS));

        $this->postJson('/api/personnel', $this->fiche(['matricule_pers' => 'TEST-PHPUNIT-P3', 'salaire_pers' => 777777]))->assertCreated();
        $this->assertSame(777777, $this->salaireEnBase('TEST-PHPUNIT-P3'));
    }

    public function test_sans_connexion_rien_n_est_accessible(): void
    {
        $this->getJson('/api/personnel')->assertStatus(401);
        $this->getJson('/api/personnel/' . self::HAUT)->assertStatus(401);
    }
}
