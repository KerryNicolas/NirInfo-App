<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

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
    /**
     * Enregistre un mouvement : solde du compte, journal `transaction` et
     * `gestion_compte`, dans une seule transaction SQL (tout ou rien).
     *
     * @param  int     $idCompte
     * @param  float   $montant
     * @param  string  $sens     'E' (entrée, +) ou 'S' (sortie, -)
     * @param  string  $raison   texte journalisé dans transaction.reson
     * @return int     id_transaction de l'écriture créée
     */
    public function mouvement(int $idCompte, float $montant, string $sens, string $raison): int
    {
        return DB::transaction(function () use ($idCompte, $montant, $sens, $raison) {
            // Verrou sur la ligne du compte jusqu'à la fin de la transaction.
            // Un compte inexistant ne lève pas d'erreur, comme avant : certains
            // anciens paiements portent un libellé (« Mobile Money ») au lieu
            // d'un numéro de compte, et doivent rester modifiables.
            DB::table('compte')->where('id_compte', $idCompte)->lockForUpdate()->first();

            if ($sens === 'E') {
                DB::table('compte')->where('id_compte', $idCompte)->increment('montant', $montant);
            } else {
                DB::table('compte')->where('id_compte', $idCompte)->decrement('montant', $montant);
            }

            $idTransaction = DB::table('transaction')->insertGetId([
                'transaction_type' => $sens,
                'amount'           => $montant,
                'reson'            => $raison,
                'account'          => $idCompte,
                'date_transaction' => now()->toDateString(),
            ]);

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
