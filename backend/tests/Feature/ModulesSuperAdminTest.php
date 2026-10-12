<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Gestion des modules réservée à l'administrateur principal (super-admin).
// L'admin secondaire garde tout le reste ; la lecture des modules reste
// ouverte à tous (autocomplétion des sessions, de l'état, des certifications).
class ModulesSuperAdminTest extends TestCase
{
    private const CODE = 'TEST-PHPUNIT-MOD';

    protected function setUp(): void
    {
        parent::setUp();

        // Rôle super-admin et permission modules.manage (annulés à la fin,
        // comme tout le reste) : le test ne dépend pas de l'état de la base.
        $this->seed(RolePermissionSeeder::class);
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

    private function module(): array
    {
        return ['code_module' => self::CODE, 'nom' => 'Module de test PHPUnit', 'description' => ''];
    }

    public static function comptesSansGestionDesModules(): array
    {
        return ['utilisateur simple' => ['user'], 'admin secondaire' => ['admin']];
    }

    /** @dataProvider comptesSansGestionDesModules */
    public function test_la_gestion_des_modules_est_refusee(string $slug): void
    {
        DB::table('module')->insert(['code_module' => self::CODE, 'nom_module' => 'Existant', 'description_module' => '']);
        $this->actingAs($this->compte($slug));

        $this->postJson('/api/modules', ['code_module' => self::CODE . '2', 'nom' => 'Refusé'])->assertStatus(403);
        $this->putJson('/api/modules/' . self::CODE, ['nom' => 'Refusé'])->assertStatus(403);
        $this->deleteJson('/api/modules/' . self::CODE)->assertStatus(403);

        $this->assertSame('Existant', DB::table('module')->where('code_module', self::CODE)->value('nom_module'));
        $this->assertFalse(DB::table('module')->where('code_module', self::CODE . '2')->exists());
    }

    /** @dataProvider comptesSansGestionDesModules */
    public function test_la_lecture_des_modules_reste_ouverte(string $slug): void
    {
        DB::table('module')->insert(['code_module' => self::CODE, 'nom_module' => 'Existant', 'description_module' => '']);
        $this->actingAs($this->compte($slug));

        $this->getJson('/api/modules?search=' . self::CODE)->assertOk()->assertJsonPath('total', 1);
        $this->getJson('/api/modules/' . self::CODE)->assertOk();
    }

    public function test_l_administrateur_principal_gere_les_modules(): void
    {
        $this->actingAs($this->compte('super-admin'));

        $this->postJson('/api/modules', $this->module())->assertStatus(201);
        $this->putJson('/api/modules/' . self::CODE, ['nom' => 'Renommé'])->assertOk();
        $this->assertSame('Renommé', DB::table('module')->where('code_module', self::CODE)->value('nom_module'));

        $this->deleteJson('/api/modules/' . self::CODE)->assertOk();
        $this->assertFalse(DB::table('module')->where('code_module', self::CODE)->exists());
    }

    public function test_l_administrateur_principal_reste_un_admin_partout(): void
    {
        $principal = $this->compte('super-admin');
        $this->actingAs($principal);

        $this->assertTrue($principal->isAdmin());
        // Permission portée par le seul rôle admin : il l'a quand même.
        $this->assertTrue($principal->hasPermission('budgets.access'));
        $this->getJson('/api/comptes-budget')->assertOk();
        // Suppressions réservées aux admins (middleware admin.delete).
        $this->assertNotSame(403, $this->deleteJson('/api/horaires/INEXISTANT')->getStatusCode());

        $permissions = $this->getJson('/api/user')->assertOk()->assertJsonPath('role_slug', 'super-admin')->json('permissions');
        $this->assertContains('modules.manage', $permissions);
        $this->assertContains('budgets.access', $permissions);
    }

    public function test_l_admin_secondaire_garde_ses_autres_droits(): void
    {
        $admin = $this->compte('admin');
        $this->actingAs($admin);

        $this->assertTrue($admin->isAdmin());
        $this->assertFalse($admin->hasPermission('modules.manage'));
        $this->getJson('/api/comptes-budget')->assertOk();
        $this->assertNotSame(403, $this->deleteJson('/api/horaires/INEXISTANT')->getStatusCode());
        $this->assertNotContains('modules.manage', $this->getJson('/api/user')->json('permissions'));
    }

    public static function comptesAdministrateurs(): array
    {
        return ['admin secondaire' => ['admin'], 'administrateur principal' => ['super-admin']];
    }

    /** @dataProvider comptesAdministrateurs */
    public function test_le_role_super_admin_ne_s_attribue_pas_par_l_api(string $slug): void
    {
        $this->actingAs($this->compte($slug));
        $superAdminId = Role::where('slug', 'super-admin')->value('id');

        $this->postJson('/api/users', [
            'nom' => 'Test', 'prenom' => 'Phpunit', 'email' => 'phpunit-nouveau@test.local', 'role_id' => $superAdminId,
        ])->assertStatus(422)->assertJsonValidationErrors('role_id');

        $this->assertFalse(DB::table('users')->where('email', 'phpunit-nouveau@test.local')->exists());
        $this->assertNotContains('super-admin', array_column($this->getJson('/api/roles')->assertOk()->json(), 'slug'));
    }

    public function test_un_utilisateur_simple_ne_cree_toujours_pas_de_compte(): void
    {
        $this->actingAs($this->compte('user'));

        $this->postJson('/api/users', [
            'nom' => 'Test', 'prenom' => 'Phpunit', 'email' => 'phpunit-nouveau@test.local',
            'role_id' => Role::where('slug', 'user')->value('id'),
        ])->assertStatus(403);
    }
}
