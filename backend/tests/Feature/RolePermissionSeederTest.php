<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Le seeder des rôles ne doit JAMAIS modifier un compte utilisateur, ni
// retirer une permission : il ajoute seulement ce qui manque.
class RolePermissionSeederTest extends TestCase
{
    private function rolesDesComptes(): array
    {
        return DB::table('users')->orderBy('id')->pluck('role_id', 'id')->all();
    }

    public function test_les_roles_des_comptes_existants_ne_changent_pas(): void
    {
        $avant = $this->rolesDesComptes();
        $this->assertNotEmpty($avant, 'La base de test doit contenir des comptes.');

        $this->seed(RolePermissionSeeder::class);

        $this->assertSame($avant, $this->rolesDesComptes());
    }

    public function test_le_nombre_d_administrateurs_ne_change_pas(): void
    {
        $adminId = DB::table('roles')->where('slug', 'admin')->value('id');
        $avant   = DB::table('users')->where('role_id', $adminId)->count();
        $this->assertGreaterThanOrEqual(1, $avant, 'Il doit exister au moins un administrateur avant le test.');

        $this->seed(RolePermissionSeeder::class);

        $this->assertSame($avant, DB::table('users')->where('role_id', $adminId)->count());
    }

    public function test_roles_et_permissions_presents_sans_doublon(): void
    {
        $this->seed(RolePermissionSeeder::class);

        $this->assertSame(1, DB::table('roles')->where('slug', 'admin')->count());
        $this->assertSame(1, DB::table('roles')->where('slug', 'user')->count());

        // budgets.access est la permission réellement exigée par routes/api.php
        foreach (['budgets.access', 'services.access', 'certifications.valider', 'users.manage'] as $slug) {
            $this->assertSame(1, DB::table('permissions')->where('slug', $slug)->count(), "Permission {$slug}");
            $this->assertTrue(
                Role::where('slug', 'admin')->first()->permissions()->where('slug', $slug)->exists(),
                "Le rôle admin doit avoir {$slug}"
            );
        }

        $doublons = DB::table('role_permissions')
            ->select('role_id', 'permission_id')
            ->groupBy('role_id', 'permission_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();
        $this->assertCount(0, $doublons, 'Aucune permission ne doit être attribuée deux fois au même rôle.');
    }

    public function test_deux_executions_donnent_le_meme_resultat(): void
    {
        $this->seed(RolePermissionSeeder::class);
        $etat = [
            DB::table('roles')->count(),
            DB::table('permissions')->count(),
            DB::table('role_permissions')->count(),
            $this->rolesDesComptes(),
        ];

        $this->seed(RolePermissionSeeder::class);

        $this->assertSame($etat, [
            DB::table('roles')->count(),
            DB::table('permissions')->count(),
            DB::table('role_permissions')->count(),
            $this->rolesDesComptes(),
        ]);
    }

    public function test_une_permission_accordee_a_la_main_est_conservee(): void
    {
        $user       = Role::where('slug', 'user')->firstOrFail();
        $permission = Permission::create(['slug' => 'test.permission.manuelle', 'name' => 'Permission de test']);
        $user->permissions()->attach($permission->id);

        $this->seed(RolePermissionSeeder::class);

        $this->assertTrue(
            $user->permissions()->where('slug', 'test.permission.manuelle')->exists(),
            'Le seeder ne doit pas retirer une permission accordée par ailleurs.'
        );
    }
}
