<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Traçabilité du journal `transaction`. AJOUTS UNIQUEMENT, toutes les colonnes
 * sont facultatives : les 7 999 écritures existantes ne sont pas modifiées et
 * le code actuel, qui ne renseigne pas ces colonnes, continue de fonctionner.
 *
 *  - type_operation        : nature de l'écriture (achat, charge, virement…),
 *                            au lieu de la déduire du texte libre `reson` ;
 *  - origine_table/_id     : la ligne métier à l'origine de l'écriture ;
 *  - transaction_annulee_id: pour une écriture inverse, le numéro de
 *                            l'écriture qu'elle annule. Index UNIQUE : une
 *                            écriture ne peut être annulée qu'une seule fois,
 *                            même si deux annulations partent en même temps ;
 *  - reference_virement    : référence commune aux deux écritures d'un virement ;
 *  - cree_par / cree_le    : utilisateur, date et heure.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('transaction', 'type_operation')) {
            return;
        }

        Schema::table('transaction', function (Blueprint $t) {
            $t->string('type_operation', 40)->nullable();
            $t->string('origine_table', 40)->nullable();
            $t->unsignedBigInteger('origine_id')->nullable();
            $t->integer('transaction_annulee_id')->nullable();
            $t->string('reference_virement', 40)->nullable();
            $t->unsignedBigInteger('cree_par')->nullable();
            $t->dateTime('cree_le')->nullable();

            $t->unique('transaction_annulee_id', 'transaction_annulee_unique');
            $t->index(['origine_table', 'origine_id'], 'transaction_origine_index');
            $t->index('reference_virement', 'transaction_virement_index');
        });
    }

    public function down(): void
    {
        Schema::table('transaction', function (Blueprint $t) {
            $t->dropUnique('transaction_annulee_unique');
            $t->dropIndex('transaction_origine_index');
            $t->dropIndex('transaction_virement_index');
            $t->dropColumn([
                'type_operation', 'origine_table', 'origine_id', 'transaction_annulee_id',
                'reference_virement', 'cree_par', 'cree_le',
            ]);
        });
    }
};
