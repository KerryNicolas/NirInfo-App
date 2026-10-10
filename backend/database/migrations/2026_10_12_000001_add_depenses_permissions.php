<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Permissions du suivi des dépenses : depenses.valider et depenses.payer,
 * attribuées au rôle admin.
 *
 * AJOUTS UNIQUEMENT : aucun compte, aucune permission existante et aucune
 * attribution existante ne sont modifiés.
 *
 * Réversible sans risque : chaque permission créée ici porte une marque dans
 * sa colonne `description`. down() ne retire QUE les permissions marquées (et
 * leurs attributions). Une permission du même nom créée autrement — par le
 * seeder sur une installation neuve, par exemple — n'est ni modifiée par
 * up(), ni retirée par down().
 */
return new class extends Migration
{
    private const MARQUE = 'Créée par la migration 2026_10_12_000001_add_depenses_permissions';

    private const PERMISSIONS = [
        'depenses.valider' => 'Valider une dépense (achat ou charge)',
        'depenses.payer'   => 'Payer une dépense ou annuler son paiement',
    ];

    public function up(): void
    {
        $adminId = DB::table('roles')->where('slug', 'admin')->value('id');

        foreach (self::PERMISSIONS as $slug => $name) {
            if (DB::table('permissions')->where('slug', $slug)->exists()) {
                continue; // déjà là : on n'y touche pas
            }

            $id = DB::table('permissions')->insertGetId([
                'slug'        => $slug,
                'name'        => $name,
                'description' => self::MARQUE,
                'created_at'  => now(),
                'updated_at'  => now(),
            ]);

            if ($adminId) {
                DB::table('role_permissions')->insert([
                    'role_id'       => $adminId,
                    'permission_id' => $id,
                    'created_at'    => now(),
                    'updated_at'    => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        $ids = DB::table('permissions')
            ->whereIn('slug', array_keys(self::PERMISSIONS))
            ->where('description', self::MARQUE)
            ->pluck('id');

        // Pas de clé étrangère sur ces tables : les attributions se retirent à la main, d'abord.
        DB::table('role_permissions')->whereIn('permission_id', $ids)->delete();
        DB::table('permissions')->whereIn('id', $ids)->delete();
    }
};
