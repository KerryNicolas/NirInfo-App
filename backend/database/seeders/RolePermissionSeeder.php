<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;
use App\Models\User;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Rôles
        $admin = Role::firstOrCreate(['slug' => 'admin'], ['name' => 'Administrateur']);
        $user  = Role::firstOrCreate(['slug' => 'user'],  ['name' => 'Utilisateur simple']);

        $permissions = [
            'formations.access'          => 'Accès module Formations',
            'logistique.access'          => 'Accès module Logistique',
            'personnel.access'           => 'Accès module Personnel',
            'services.access'            => 'Accès module Services',
            'budget.access'              => 'Accès Gestion du budget',
            'certifications.valider'     => 'Confirmer/valider une certification',
            'certifications.prix.manage' => 'Modifier le prix standard des certificats',
            'users.manage'               => 'Gérer les comptes utilisateurs',
        ];

        foreach ($permissions as $slug => $name) {
            Permission::firstOrCreate(['slug' => $slug], ['name' => $name]);
        }

        // Admin = toutes les permissions
        $admin->permissions()->sync(Permission::pluck('id'));

        // User simple = Formations, Logistique, Personnel uniquement
        $userPerms = Permission::whereIn('slug', [
            'formations.access', 'logistique.access', 'personnel.access',
        ])->pluck('id');
        $user->permissions()->sync($userPerms);

        // Promotion : Info (id=1) devient admin, le reste passe en 'user'
        User::where('id', 1)->update(['role_id' => $admin->id]);
        User::where('id', '!=', 1)->update(['role_id' => $user->id]);
    }
}