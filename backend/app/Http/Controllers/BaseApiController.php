<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * BaseApiController — supporte à la fois :
 *  - Eloquent Builder  (App\Models\Xxx::query()->...)
 *  - Query Builder     (DB::table('xxx')->...)
 *
 * Format de réponse toujours identique :
 * { data, total, per_page, current_page, last_page, from, to }
 */
abstract class BaseApiController extends Controller
{
    /**
     * Pagine un Builder (Eloquent OU Query) avec search + sort + LIFO.
     *
     * @param  \Illuminate\Database\Eloquent\Builder|\Illuminate\Database\Query\Builder  $query
     * @param  Request  $request
     * @param  array    $searchCols   Colonnes pour la recherche  ex: ['m.nom_module']
     * @param  string   $defaultSort  Colonne de tri par défaut   ex: 'm.code_module'
     */
    protected function paginate(
        $query,
        Request $request,
        array   $searchCols  = [],
        string  $defaultSort = 'id'
    ): JsonResponse {

        // ── Recherche ──
        if ($request->filled('search') && count($searchCols) > 0) {
            $q = $request->search;
            $query->where(function ($sub) use ($q, $searchCols) {
                foreach ($searchCols as $i => $col) {
                    $i === 0
                        ? $sub->where($col, 'like', "%{$q}%")
                        : $sub->orWhere($col, 'like', "%{$q}%");
                }
            });
        }

        // ── Tri ──
        $sort    = $request->input('sort',     $defaultSort);
        $sortDir = $request->input('sort_dir', 'desc');

        if (preg_match('/^[\w.]+$/', $sort)) {
            $query->orderBy($sort, $sortDir === 'asc' ? 'asc' : 'desc');
        } else {
            $query->orderBy($defaultSort, 'desc');
        }

        // ── Pagination ──
        $perPage   = max(1, min((int) $request->input('per_page', 15), 200));
        $paginator = $query->paginate($perPage);

        return response()->json([
            'data'         => $paginator->items(),
            'total'        => $paginator->total(),
            'per_page'     => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page'    => $paginator->lastPage(),
            'from'         => $paginator->firstItem() ?? 0,
            'to'           => $paginator->lastItem()  ?? 0,
        ]);
    }

    /** Réponse succès standard */
    protected function ok(string $message, array $extra = [], int $status = 200): JsonResponse
    {
        return response()->json(array_merge(['message' => $message], $extra), $status);
    }

    /** Réponse erreur standard */
    protected function err(string $message, int $status = 422): JsonResponse
    {
        return response()->json(['message' => $message], $status);
    }

    /**
     * ══════════════════════════════════════════════════════════════════
     * FIX ARCHITECTURE (partagé InscriptionController + RecouvrementController)
     *
     * Source unique de vérité pour reste_a_payer sur la table `inscription`.
     * reste_a_payer n'est JAMAIS calculé avec sa propre formule locale dans
     * store()/update() — on réécrit toujours la chaîne complète des
     * paiements d'un (matricule, code_session) donné, dans l'ordre
     * chronologique (id_paiement ASC), en cumulant. Garantit qu'après
     * n'importe quelle création, modification ou suppression touchant ce
     * couple étudiant/session, toutes les lignes concernées redeviennent
     * cohérentes entre elles.
     *
     * À appeler après CHAQUE insert/update/delete sur `inscription`, pour
     * le(s) groupe(s) matricule/session affecté(s) (l'ancien ET le nouveau
     * si l'étudiant ou la session a changé sur une ligne existante).
     * ══════════════════════════════════════════════════════════════════
     */
    protected function recalculerResteAPayer(string $matricule, string $codeSession): void
    {
        $session = DB::table('session')->where('code_session', $codeSession)->first();
        $frais   = $session ? floatval($session->frais_module) : 0;

        $lignes = DB::table('inscription')
            ->where('matricule_etudiant', $matricule)
            ->where('code_session', $codeSession)
            ->orderBy('id_paiement', 'ASC')
            ->get();

        $cumul = 0;
        foreach ($lignes as $ligne) {
            $cumul += floatval($ligne->montant_paye);
            $reste  = max(0, $frais - $cumul);
            DB::table('inscription')->where('id_paiement', $ligne->id_paiement)
                ->update(['reste_a_payer' => $reste]);
        }
    }

    /**
     * Ajuste le solde d'un compte + journalise le mouvement (transaction +
     * gestion_compte) — logique comptable centralisée pour ne pas la
     * dupliquer entre store(), update() et destroy() dans chaque contrôleur
     * qui manipule de l'argent.
     *
     * @param  int     $idCompte
     * @param  float   $montant
     * @param  string  $sens     'E' (entrée, +) ou 'S' (sortie, -)
     * @param  string  $raison   texte libre journalisé dans transaction.reson
     */
    protected function ajusterSoldeCompte(int $idCompte, float $montant, string $sens, string $raison): void
    {
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
    }
}