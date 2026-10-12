<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Photo de profil des comptes : users.photo, chemin du fichier sur le disque
 * « public » (même principe que personnel.photo_pers).
 *
 * AJOUT UNIQUEMENT : une colonne facultative. Aucun compte existant n'est
 * modifié — sans photo, l'application continue d'afficher les initiales.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('users', 'photo')) {
            return;
        }

        Schema::table('users', function (Blueprint $table) {
            $table->string('photo')->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'photo')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('photo');
            });
        }
    }
};
