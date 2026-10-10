<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Marqueur « ancien système » sur les dépenses — tables `achat` et `charge`.
 *
 * AJOUT UNIQUEMENT : une colonne `ancien_systeme` (0 par défaut). Aucune
 * colonne existante n'est modifiée.
 *
 * Les dépenses héritées de l'ancien système sont verrouillées par
 * l'application (ni modification, ni suppression, ni annulation de paiement).
 * Pour les reconnaître sans dépendre d'un champ vide, on les marque ici, une
 * fois pour toutes, quand QUATRE critères indépendants sont réunis :
 *   1. une écriture au journal certaine : même numéro, sortie, même montant,
 *      motif égal au nom de la table, compte existant ;
 *   2. cette écriture est antérieure à la traçabilité (ni horodatage ni type) ;
 *   3. la dépense est « payee » sans auteur de paiement (statut posé par la
 *      migration 2026_10_11_000001, pas par un paiement de l'application) ;
 *   4. l'auteur de la saisie n'est pas un identifiant de la nouvelle
 *      application (vide, ou matricule de l'ancien système).
 *
 * Une dépense saisie par l'application garde 0 : aucune route ne modifie
 * cette colonne.
 */
return new class extends Migration
{
    private const TABLES = ['achat', 'charge'];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            if (Schema::hasColumn($table, 'ancien_systeme')) {
                continue;
            }

            Schema::table($table, function (Blueprint $t) {
                $t->boolean('ancien_systeme')->default(false);
            });

            DB::statement(
                "UPDATE `{$table}` d
                   JOIN `transaction` x ON x.id_transaction = d.id_transaction
                   JOIN `compte` c ON c.id_compte = x.account
                    SET d.ancien_systeme = 1
                  WHERE d.id_transaction > 0
                    AND x.transaction_type = 'S' AND x.amount = d.montant AND x.reson = ?
                    AND x.cree_le IS NULL AND x.type_operation IS NULL
                    AND d.statut = 'payee' AND d.paye_par IS NULL
                    AND (d.matricule_s IS NULL OR d.matricule_s NOT REGEXP '^[0-9]+$')",
                [$table]
            );
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $t) {
                $t->dropColumn('ancien_systeme');
            });
        }
    }
};
