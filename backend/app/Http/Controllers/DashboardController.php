<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Etudiant;
use App\Models\Session;
use App\Models\Inscription;

class DashboardController extends Controller
{
    public function stats()
    {
        try {
            return response()->json([
                'total_etudiants'     => class_exists(\App\Models\Etudiant::class)     ? \App\Models\Etudiant::count()     : 0,
                'sessions_actives'    => class_exists(\App\Models\Session::class)      ? \App\Models\Session::where('statut', 'actif')->count() : 0,
                'inscriptions_mois'   => class_exists(\App\Models\Inscription::class)  ? \App\Models\Inscription::whereMonth('created_at', now()->month)->count() : 0,
                'revenus_mois'        => 0,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'total_etudiants'   => 0,
                'sessions_actives'  => 0,
                'inscriptions_mois' => 0,
                'revenus_mois'      => 0,
            ]);
        }
    }
}