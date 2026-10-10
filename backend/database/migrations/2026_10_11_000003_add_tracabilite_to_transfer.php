<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Traçabilité des virements — table `transfer`. AJOUTS UNIQUEMENT, colonnes
 * facultatives : le virement existant n'est pas modifié.
 *
 * Un virement produira deux écritures au journal (sortie du compte de départ,
 * entrée sur le compte de destination) ; leurs numéros sont gardés ici.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('transfer', 'date_transfer')) {
            return;
        }

        Schema::table('transfer', function (Blueprint $t) {
            $t->dateTime('date_transfer')->nullable();
            $t->unsignedBigInteger('cree_par')->nullable();
            $t->integer('id_transaction_debit')->nullable();
            $t->integer('id_transaction_credit')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('transfer', function (Blueprint $t) {
            $t->dropColumn(['date_transfer', 'cree_par', 'id_transaction_debit', 'id_transaction_credit']);
        });
    }
};
