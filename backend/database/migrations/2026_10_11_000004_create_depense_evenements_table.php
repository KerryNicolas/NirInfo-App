<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Historique des actions sur les dépenses (achats et charges) : qui a saisi,
 * validé, payé ou annulé, quand, sur quel compte et avec quelle écriture.
 *
 * Nouvelle table, sans lien obligatoire avec les tables existantes. On y
 * AJOUTE des lignes, on n'en modifie jamais : un cycle « payer, annuler,
 * repayer » garde ainsi toutes ses étapes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('depense_evenements')) {
            return;
        }

        Schema::create('depense_evenements', function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('type_depense', 20);              // 'achat' ou 'charge'
            $t->integer('id_depense');                   // id_achat ou id_charge
            $t->string('action', 30);                    // saisie, validation, paiement, annulation_paiement, annulation
            $t->string('statut_avant', 20)->nullable();
            $t->string('statut_apres', 20)->nullable();
            $t->integer('id_compte')->nullable();
            $t->decimal('montant', 15, 2)->nullable();
            $t->integer('id_transaction')->nullable();   // écriture du journal liée à l'action
            $t->string('motif', 255)->nullable();
            $t->unsignedBigInteger('user_id')->nullable();
            $t->dateTime('created_at');

            $t->index(['type_depense', 'id_depense'], 'depense_evenements_depense_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('depense_evenements');
    }
};
