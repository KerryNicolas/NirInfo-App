<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

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
}