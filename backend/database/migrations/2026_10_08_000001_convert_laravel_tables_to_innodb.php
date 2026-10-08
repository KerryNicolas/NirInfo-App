<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Passe en InnoDB les tables créées par Laravel, qui étaient en MyISAM
 * (moteur par défaut du MySQL de WAMP au moment de leur création).
 *
 * Emplacement : backend/database/migrations/2026_10_08_000001_convert_laravel_tables_to_innodb.php
 *
 * Pourquoi : MyISAM ignore les transactions. Dans AuthController::createUser(),
 * le DB::rollBack() annulait bien la ligne `salarie` (InnoDB) mais PAS la
 * ligne `users` ni le jeton d'activation : un envoi d'email raté laissait un
 * compte à moitié créé, dont l'adresse email restait prise.
 *
 * Les tables métier héritées (etudiant, inscription, compte...) sont déjà en
 * InnoDB et ne sont pas touchées. Les données sont conservées telles quelles.
 */
return new class extends Migration
{
    private const TABLES = [
        'users',
        'roles',
        'permissions',
        'role_permissions',
        'password_reset_tokens',
        'account_activation_tokens',
        'personal_access_tokens',
        'migrations',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            $engine = DB::table('information_schema.TABLES')
                ->whereRaw('TABLE_SCHEMA = DATABASE()')
                ->where('TABLE_NAME', $table)
                ->value('ENGINE');

            if (strcasecmp((string) $engine, 'InnoDB') !== 0) {
                DB::statement("ALTER TABLE `{$table}` ENGINE = InnoDB");
            }
        }
    }

    public function down(): void
    {
        // Volontairement vide : revenir à MyISAM réintroduirait le bug des
        // comptes à moitié créés.
    }
};
