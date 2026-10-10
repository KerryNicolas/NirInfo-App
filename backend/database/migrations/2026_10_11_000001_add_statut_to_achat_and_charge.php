<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Suivi des dépenses : statut, compte, traçabilité — tables `achat` et `charge`.
 *
 * AJOUTS UNIQUEMENT : aucune colonne existante n'est modifiée, renommée ni
 * supprimée. `id_transaction` garde sa signification (0 = pas d'écriture).
 *
 * Unicité : `id_transaction_unique` est une colonne CALCULÉE par MySQL
 * (NULL quand id_transaction vaut 0, sinon sa valeur) portant un index unique.
 * Une même écriture du journal ne peut donc servir qu'à une seule ligne de la
 * table, tandis que plusieurs lignes peuvent rester à 0.
 *
 * Seule écriture de données : les dépenses de l'ancien système dont la sortie
 * au journal est CERTAINE (même numéro, sortie, même montant, motif égal au
 * nom de la table, compte existant) passent à « payee » et reçoivent le compte
 * et la date de cette écriture. Aucune ligne n'est créée dans le journal.
 */
return new class extends Migration
{
    private const TABLES = ['achat', 'charge'];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            if (Schema::hasColumn($table, 'statut')) {
                continue;
            }

            Schema::table($table, function (Blueprint $t) use ($table) {
                $t->string('statut', 20)->default('enregistree');
                $t->integer('id_compte')->nullable();
                $t->unsignedBigInteger('valide_par')->nullable();
                $t->dateTime('date_validation')->nullable();
                $t->unsignedBigInteger('paye_par')->nullable();
                $t->dateTime('date_paiement')->nullable();
                $t->unsignedBigInteger('annule_par')->nullable();
                $t->dateTime('date_annulation')->nullable();
                $t->string('motif_annulation', 255)->nullable();
                $t->integer('id_transaction_unique')->nullable()->virtualAs('NULLIF(id_transaction, 0)');

                $t->index('statut', "{$table}_statut_index");
                $t->unique('id_transaction_unique', "{$table}_id_transaction_unique");
            });

            DB::statement(
                "UPDATE `{$table}` d
                   JOIN `transaction` t ON t.id_transaction = d.id_transaction
                   JOIN `compte` c ON c.id_compte = t.account
                    SET d.statut = 'payee', d.id_compte = t.account, d.date_paiement = t.date_transaction
                  WHERE d.id_transaction > 0
                    AND t.transaction_type = 'S'
                    AND t.amount = d.montant
                    AND t.reson = ?",
                [$table]
            );
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t) use ($table) {
                $t->dropUnique("{$table}_id_transaction_unique");
                $t->dropIndex("{$table}_statut_index");
                $t->dropColumn([
                    'id_transaction_unique', 'statut', 'id_compte', 'valide_par', 'date_validation',
                    'paye_par', 'date_paiement', 'annule_par', 'date_annulation', 'motif_annulation',
                ]);
            });
        }
    }
};
