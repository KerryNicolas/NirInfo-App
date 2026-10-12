<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// « Montant perçu » du module Certificat : réservé aux administrateurs. Le
// reste du module (liste, prix standard, lecture des modules) ne change pas
// pour l'utilisateur simple.
class CertificationMontantTest extends TestCase
{
    // Période de test loin dans le futur : aucun certificat réel n'y tombe,
    // les totaux attendus sont donc exacts.
    private const DEBUT = '2099-01-01';
    private const FIN   = '2099-01-31';

    protected function setUp(): void
    {
        parent::setUp();

        // Rôle super-admin (annulé à la fin, comme tout le reste).
        $this->seed(RolePermissionSeeder::class);

        $this->certificat('TEST-PHPUNIT-C1', '2099-01-05', 1, 10000);
        $this->certificat('TEST-PHPUNIT-C2', '2099-01-20', 1, 25000);
        $this->certificat('TEST-PHPUNIT-C3', '2099-01-10', 0, 40000); // non validé : exclu
        $this->certificat('TEST-PHPUNIT-C4', '2099-01-12', 1, null);  // sans prix : exclu
        $this->certificat('TEST-PHPUNIT-C5', '2099-02-15', 1, 70000); // hors période : exclu
    }

    private function certificat(string $reference, string $date, int $accept, ?int $prix): void
    {
        DB::table('certificat')->insert([
            'reference'     => $reference,
            'debut_session' => $date,
            'fin_session'   => $date,
            'date'          => $date . ' 10:00:00',
            'accept'        => $accept,
            'prix'          => $prix,
            'origine'       => 'manuel',
            'nom_manuel'    => 'TEST PHPUNIT',
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

    private function montant(array $periode = ['date_debut' => self::DEBUT, 'date_fin' => self::FIN])
    {
        return $this->getJson('/api/certifications/montant?' . http_build_query($periode));
    }

    public function test_l_utilisateur_simple_est_refuse(): void
    {
        $this->actingAs($this->compte('user'));

        $reponse = $this->montant()->assertStatus(403)->assertExactJson(['message' => 'Accès refusé.']);

        // Aucun chiffre ne fuit dans le refus, avec ou sans période.
        $this->assertArrayNotHasKey('montant', $reponse->json());
        $this->montant([])->assertStatus(403)->assertJsonMissingPath('montant')->assertJsonMissingPath('nb');
    }

    public static function administrateurs(): array
    {
        return ['admin' => ['admin'], 'administrateur principal' => ['super-admin']];
    }

    /** @dataProvider administrateurs */
    public function test_les_administrateurs_obtiennent_le_total_exact(string $slug): void
    {
        $this->actingAs($this->compte($slug));

        // Seuls C1 et C2 comptent : validés, avec un prix, dans la période.
        $resultat = $this->montant()->assertOk()->json();
        $this->assertSame(2, $resultat['nb']);
        $this->assertEqualsWithDelta(35000, (float) $resultat['montant'], 0.001);

        // Période élargie : C5 s'ajoute.
        $resultat = $this->montant(['date_debut' => self::DEBUT, 'date_fin' => '2099-02-28'])->assertOk()->json();
        $this->assertSame(3, $resultat['nb']);
        $this->assertEqualsWithDelta(105000, (float) $resultat['montant'], 0.001);

        // Période vide.
        $resultat = $this->montant(['date_debut' => '2098-01-01', 'date_fin' => '2098-01-31'])->assertOk()->json();
        $this->assertSame(0, $resultat['nb']);
        $this->assertEqualsWithDelta(0, (float) $resultat['montant'], 0.001);
    }

    public function test_l_utilisateur_simple_garde_la_liste_des_certificats(): void
    {
        $this->actingAs($this->compte('user'));

        $liste = $this->getJson('/api/certifications?search=TEST-PHPUNIT-C&per_page=50')->assertOk()->json();
        $this->assertSame(5, $liste['total']);

        // Les données nécessaires au traitement d'un certificat sont toujours là.
        $c1 = collect($liste['data'])->firstWhere('reference', 'TEST-PHPUNIT-C1');
        $this->assertSame('TEST PHPUNIT', $c1['nom_complet']);
        $this->assertEqualsWithDelta(10000, (float) $c1['prix'], 0.001);
        $this->assertSame(1, (int) $c1['accept']);
        $this->assertSame('manuel', $c1['origine']);
    }

    public function test_l_utilisateur_simple_garde_le_prix_standard_et_les_modules(): void
    {
        $this->actingAs($this->compte('user'));

        $attendu = (float) (DB::table('prix_certificat')->orderByDesc('id_prix_certificat')->value('prix') ?? 0);
        $this->assertEqualsWithDelta($attendu, (float) $this->getJson('/api/certifications/prix')->assertOk()->json('prix'), 0.001);

        $modules = $this->getJson('/api/modules?per_page=5')->assertOk()->json();
        $this->assertSame(DB::table('module')->count(), $modules['total']);
    }

    public function test_les_autres_droits_du_module_certificat_ne_changent_pas(): void
    {
        // Utilisateur simple : toujours refusé sur ce qui était réservé à l'admin.
        $this->actingAs($this->compte('user'));
        $this->getJson('/api/certifications/prix/historique')->assertStatus(403);
        $this->postJson('/api/certifications/prix', ['prix' => 1])->assertStatus(403);
        $this->postJson('/api/certifications/manuel', [])->assertStatus(403);
        $this->deleteJson('/api/certifications/TEST-PHPUNIT-C3')->assertStatus(403);
        $this->assertTrue(DB::table('certificat')->where('reference', 'TEST-PHPUNIT-C3')->exists());

        // Admin : garde l'historique des prix, à l'identique.
        $this->actingAs($this->compte('admin'));
        $historique = $this->getJson('/api/certifications/prix/historique')->assertOk()->json();
        $this->assertCount(DB::table('prix_certificat')->count(), $historique);
    }
}
