<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats()
    {
        try {
            // Total étudiants
            $totalEtudiants = DB::table('etudiant')->count();

            // Sessions actives (date_fin >= aujourd'hui)
            $sessionsActives = DB::table('session')
                ->where('date_fin', '>=', now()->toDateString())
                ->count();

            // Inscriptions du mois en cours
            $inscriptionsMois = DB::table('inscription')
                ->whereMonth('date_paiement', now()->month)
                ->whereYear('date_paiement', now()->year)
                ->count();

            // Revenus du mois (inscriptions + recouvrements)
            $revenusMois = DB::table('inscription')
                ->whereMonth('date_paiement', now()->month)
                ->whereYear('date_paiement', now()->year)
                ->sum('montant_paye')
                +
                DB::table('recouvrement')
                ->whereMonth('date_paiement', now()->month)
                ->whereYear('date_paiement', now()->year)
                ->sum('montant_paye');

            // Dernières inscriptions (10 dernières)
            $dernieresInscriptions = DB::table('inscription as i')
                ->join('etudiant as e', 'i.matricule', '=', 'e.matricule')
                ->leftJoin('session as s', 'i.code_session', '=', 's.code_session')
                ->select(
                    'i.id_paiement',
                    'i.matricule',
                    DB::raw("CONCAT(e.nom, ' ', e.prenom) as nom_complet"),
                    'i.code_session',
                    'i.date_paiement',
                    'i.montant_paye',
                    'i.reste'
                )
                ->orderBy('i.id_paiement', 'DESC')
                ->limit(10)
                ->get();

            return response()->json([
                'stats' => [
                    'total_etudiants'   => $totalEtudiants,
                    'sessions_actives'  => $sessionsActives,
                    'inscriptions_mois' => $inscriptionsMois,
                    'revenus_mois'      => $revenusMois,
                ],
                'dernieres_inscriptions' => $dernieresInscriptions,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'stats' => [
                    'total_etudiants'   => 0,
                    'sessions_actives'  => 0,
                    'inscriptions_mois' => 0,
                    'revenus_mois'      => 0,
                ],
                'dernieres_inscriptions' => [],
                'error' => $e->getMessage(),
            ]);
        }
    }
}