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
        // Administrateur principal — même libellé que la migration
        // 2026_10_13_000001_add_super_admin_and_modules_permission.
        $superAdmin = Role::firstOrCreate(['slug' => 'super-admin'], ['name' => 'Administrateur principal']);

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
            // Suivi des dépenses — mêmes libellés que la migration
            // 2026_10_12_000001_add_depenses_permissions (admin uniquement).
            'depenses.valider'           => 'Valider une dépense (achat ou charge)',
            'depenses.payer'             => 'Payer une dépense ou annuler son paiement',
            // Administrateur principal uniquement — jamais le rôle admin.
            'modules.manage'             => 'Créer, modifier et supprimer les modules de formation',
        ];

        foreach ($permissions as $slug => $name) {
            Permission::firstOrCreate(['slug' => $slug], ['name' => $name]);
        }

        // Admin = toutes les permissions SAUF modules.manage (réservée à
        // l'administrateur principal). syncWithoutDetaching : le seeder
        // AJOUTE ce qui manque et ne retire jamais une permission accordée
        // par ailleurs (sync() les aurait retirées).
        $admin->permissions()->syncWithoutDetaching(
            Permission::where('slug', '!=', 'modules.manage')->pluck('id')
        );

        // Administrateur principal = toutes les permissions.
        $superAdmin->permissions()->syncWithoutDetaching(Permission::pluck('id'));

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