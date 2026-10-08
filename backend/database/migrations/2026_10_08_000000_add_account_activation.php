<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Activation des comptes créés par l'administrateur.
 *
 * Emplacement : backend/database/migrations/2026_10_08_000000_add_account_activation.php
 *
 * 1. users.activated_at : date d'activation du compte.
 *    - NULL  = compte "en attente" (créé par l'admin, lien pas encore utilisé)
 *    - date  = compte actif
 *    Les comptes déjà présents sont marqués activés (sinon ils seraient
 *    bloqués à la connexion dès l'étape suivante).
 *
 * 2. account_activation_tokens : jetons d'activation, dans une table SÉPARÉE
 *    de password_reset_tokens, pour qu'un jeton d'activation ne soit jamais
 *    accepté par la réinitialisation de mot de passe, et inversement.
 *    Même structure que password_reset_tokens (attendue par le broker Laravel).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'activated_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->timestamp('activated_at')->nullable()->after('email_verified_at');
            });

            // Comptes existants = déjà actifs.
            DB::table('users')
                ->whereNull('activated_at')
                ->update(['activated_at' => DB::raw('COALESCE(created_at, NOW())')]);
        }

        if (!Schema::hasTable('account_activation_tokens')) {
            Schema::create('account_activation_tokens', function (Blueprint $table) {
                $table->string('email', 191)->primary();
                $table->string('token', 191);
                $table->timestamp('created_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('account_activation_tokens');

        if (Schema::hasColumn('users', 'activated_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('activated_at');
            });
        }
    }
};