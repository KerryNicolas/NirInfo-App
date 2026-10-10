<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;

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
            // FIX : c'est "budgets.access" (avec un s) que routes/api.php
            // exige. L'ancien slug ci-dessus est conservé, rien n'est supprimé.
            'budgets.access'             => 'Accès Gestion des budgets',
            'certifications.valider'     => 'Confirmer/valider une certification',
            'certifications.prix.manage' => 'Modifier le prix standard des certificats',
            'users.manage'               => 'Gérer les comptes utilisateurs',
        ];

        foreach ($permissions as $slug => $name) {
            Permission::firstOrCreate(['slug' => $slug], ['name' => $name]);
        }

        // Admin = toutes les permissions. syncWithoutDetaching : le seeder
        // AJOUTE ce qui manque et ne retire jamais une permission accordée
        // par ailleurs (sync() les aurait retirées).
        $admin->permissions()->syncWithoutDetaching(Permission::pluck('id'));

        // User simple = Formations, Logistique, Personnel
        $userPerms = Permission::whereIn('slug', [
            'formations.access', 'logistique.access', 'personnel.access',
        ])->pluck('id');
        $user->permissions()->syncWithoutDetaching($userPerms);

        // FIX : ce seeder ne modifie plus AUCUN compte utilisateur. L'ancienne
        // version donnait le rôle admin à l'utilisateur n° 1 et rétrogradait
        // tous les autres : relancée sur une base existante, elle supprimait
        // le seul administrateur. L'attribution d'un rôle se fait à la
        // création du compte (AuthController::createUser).
    }
}