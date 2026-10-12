<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

// Toute suppression (requête DELETE) est réservée au rôle admin. Posé sur le
// groupe des routes protégées : couvre les routes existantes et les futures.
class AdminOnlyDelete
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->isMethod('DELETE') && !$request->user()?->isAdmin()) {
            return response()->json(['message' => 'Accès refusé.'], 403);
        }

        return $next($request);
    }
}
