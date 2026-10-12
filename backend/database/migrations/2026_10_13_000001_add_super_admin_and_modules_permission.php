<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rôle « super-admin » (Administrateur principal) et permission
 * modules.manage, attribuée à ce seul rôle.
 *
 * AJOUTS UNIQUEMENT : aucun compte n'est modifié. Désigner l'administrateur
 * principal se fait à la main, par environnement :
 *     php artisan app:promouvoir-super-admin adresse@email
 *
 * Réversible sans risque : le rôle et la permission créés ici portent une
 * marque dans leur colonne `description`. down() ne retire QUE les lignes
 * marquées : un rôle ou une permission du même nom créés autrement (par le
 * seeder, par exemple) ne sont ni modifiés par up(), ni retirés par down().
 *
 * Les comptes qui portaient le rôle redeviennent d'abord « admin ». La base
 * n'a AUCUNE clé étrangère vers `roles` ni `permissions` : rien ne le ferait
 * à notre place, et ces comptes pointeraient vers un rôle qui n'existe plus.
 * Pour la même raison, les attributions (role_permissions) se retirent à la
 * main.
 *
 * up() et down() tournent chacun dans une transaction (MySQL n'en ouvre pas
 * pour les migrations, et il n'y a ici que des lignes, pas de structure) :
 * en cas d'erreur, rien n'est modifié.
 */
return new class extends Migration
{
    private const MARQUE = 'Créée par la migration 2026_10_13_000001_add_super_admin_and_modules_permission';

    private const ROLE       = ['slug' => 'super-admin', 'name' => 'Administrateur principal'];
    private const PERMISSION = ['slug' => 'modules.manage', 'name' => 'Créer, modifier et supprimer les modules de formation'];

    public function up(): void
    {
        DB::transaction(function () {
            $roleId = DB::table('roles')->where('slug', self::ROLE['slug'])->value('id');
            if (!$roleId) {
                $roleId = DB::table('roles')->insertGetId(self::ROLE + [
                    'description' => self::MARQUE,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            $permissionId = DB::table('permissions')->where('slug', self::PERMISSION['slug'])->value('id');
            if (!$permissionId) {
                $permissionId = DB::table('permissions')->insertGetId(self::PERMISSION + [
                    'description' => self::MARQUE,
                    'created_at'  => now(),
                    'updated_at'  => now(),
                ]);
            }

            $lien = ['role_id' => $roleId, 'permission_id' => $permissionId];
            if (!DB::table('role_permissions')->where($lien)->exists()) {
                DB::table('role_permissions')->insert($lien + ['created_at' => now(), 'updated_at' => now()]);
            }
        });
    }

    public function down(): void
    {
        DB::transaction(function () {
            $roleId = DB::table('roles')
                ->where('slug', self::ROLE['slug'])
                ->where('description', self::MARQUE)
                ->value('id');

            if ($roleId) {
                $comptes = DB::table('users')->where('role_id', $roleId)->count();
                $adminId = DB::table('roles')->where('slug', 'admin')->value('id');

                // Vérifié AVANT toute modification : sans rôle admin, ces
                // comptes se retrouveraient sans rôle.
                if ($comptes > 0 && !$adminId) {
                    throw new RuntimeException(
                        "Retour arrière interrompu, rien n'a été modifié : {$comptes} compte(s) portent le rôle "
                        . "super-admin et le rôle « admin », qui devait les reprendre, n'existe pas."
                    );
                }

                if ($comptes > 0) {
                    DB::table('users')->where('role_id', $roleId)->update(['role_id' => $adminId]);
                }

                DB::table('role_permissions')->where('role_id', $roleId)->delete();
                DB::table('roles')->where('id', $roleId)->delete();
            }

            $permissionId = DB::table('permissions')
                ->where('slug', self::PERMISSION['slug'])
                ->where('description', self::MARQUE)
                ->value('id');

            if ($permissionId) {
                DB::table('role_permissions')->where('permission_id', $permissionId)->delete();
                DB::table('permissions')->where('id', $permissionId)->delete();
            }
        });
    }
};
