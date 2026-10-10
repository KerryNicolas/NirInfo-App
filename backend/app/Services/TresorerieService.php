<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Service de trésorerie — point unique d'écriture « solde + journal ».
 *
 * Reprend à l'identique la logique qui se trouvait dans
 * BaseApiController::ajusterSoldeCompte() (mêmes tables, mêmes champs, même
 * ordre), avec deux ajouts :
 *  - le compte est verrouillé le temps de l'opération : deux mouvements
 *    simultanés sur le même compte passent l'un après l'autre ;
 *  - le numéro EXACT de l'écriture créée est renvoyé (jamais « le dernier
 *    numéro de la table », qui peut appartenir à un autre utilisateur).
 */
class TresorerieService
{
    /** Colonnes de traçabilité du journal (migration 2026_10_11_000002). */
    private const TRACE = ['type_operation', 'origine_table', 'origine_id', 'transaction_annulee_id', 'reference_virement', 'cree_par'];

    /** Numéro lu pour les paiements de l'ancien système, dont le compte est un libellé. */
    private const COMPTE_HISTORIQUE = 0;

    /**
     * Un compte est « utilisé » dès qu'une écriture du journal ou un virement
     * le cite. Ne lit que des colonnes d'origine : utilisable sur toute base,
     * migrée ou non. (Les virements ne sont pas écrits au journal : un compte
     * peut donc être utilisé par un virement avec un journal vide.)
     */
    public function compteUtilise(int $idCompte): bool
    {
        return DB::table('transaction')->where('account', $idCompte)->exists()
            || DB::table('transfer')->where('starting_account', $idCompte)->orWhere('destination_account', $idCompte)->exists();
    }

    /**
     * Enregistre un mouvement : solde du compte, journal `transaction` et
     * `gestion_compte`, dans une seule transaction SQL (tout ou rien).
     *
     * @param  int     $idCompte
     * @param  float   $montant
     * @param  string  $sens     'E' (entrée, +) ou 'S' (sortie, -)
     * @param  string  $raison   texte journalisé dans transaction.reson
     * @param  array   $trace    FACULTATIF — traçabilité de l'écriture (colonnes
     *                           TRACE ci-dessous). Sans lui, l'écriture est
     *                           strictement celle d'avant : les appels existants
     *                           (inscriptions, recouvrements) ne le passent pas,
     *                           et aucune des nouvelles colonnes n'est touchée.
     * @return int     id_transaction de l'écriture créée
     */
    public function mouvement(int $idCompte, float $montant, string $sens, string $raison, array $trace = []): int
    {
        return DB::transaction(function () use ($idCompte, $montant, $sens, $raison, $trace) {
            // Verrou sur la ligne du compte jusqu'à la fin de la transaction.
            $compte = DB::table('compte')->where('id_compte', $idCompte)->lockForUpdate()->first();

            // FIX : on n'écrit plus au journal sur un compte qui n'existe pas
            // (ou qui vient d'être supprimé) — l'écriture resterait sans compte.
            // SEULE EXCEPTION, le compte 0 : les paiements de l'ancien système
            // portent un libellé (« inscription », « Mobile Money »…) au lieu
            // d'un numéro, lu comme 0 ; ils doivent rester modifiables, et
            // leur écriture se journalise sur le compte 0 comme avant.
            // Lu sur la ligne VERROUILLÉE : une suppression concurrente du
            // compte est donc vue ici.
            if (!$compte && $idCompte !== self::COMPTE_HISTORIQUE) {
                throw new HttpException(422, "Le compte n° {$idCompte} n'existe pas ou vient d'être supprimé : opération refusée.");
            }

            if ($sens === 'E') {
                DB::table('compte')->where('id_compte', $idCompte)->increment('montant', $montant);
            } else {
                DB::table('compte')->where('id_compte', $idCompte)->decrement('montant', $montant);
            }

            $ecriture = [
                'transaction_type' => $sens,
                'amount'           => $montant,
                'reson'            => $raison,
                'account'          => $idCompte,
                'date_transaction' => now()->toDateString(),
            ];

            // Traçabilité : seules les colonnes prévues sont acceptées, et
            // l'horodatage est posé ici, jamais par l'appelant.
            if ($trace !== []) {
                $ecriture += array_intersect_key($trace, array_flip(self::TRACE)) + ['cree_le' => now()];
            }

            $idTransaction = DB::table('transaction')->insertGetId($ecriture);

            DB::table('gestion_compte')->insert([
                'id_compte'      => $idCompte,
                'type'           => $sens,
                'montant'        => $montant,
                'date_gestion'   => now()->toDateString(),
                'id_transaction' => $idTransaction,
            ]);

            return (int) $idTransaction;
        });
    }
}
