<?php
namespace App\Http\Controllers;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function stats()
    {
        try {
            $totalEtudiants   = DB::table('etudiant')->count();
            
            $sessionsActives  = DB::table('session')
                                  ->where('fin_session', '>=', now()->toDateString())
                                  ->count();
            
            $inscriptionsMois = DB::table('inscription')
                                  ->whereMonth('date_paiement', now()->month)
                                  ->whereYear('date_paiement',  now()->year)
                                  ->count();
            
            $revenusMois      = DB::table('inscription')
                                  ->whereMonth('date_paiement', now()->month)
                                  ->whereYear('date_paiement',  now()->year)
                                  ->sum('montant_paye');

            $dernieres = DB::table('inscription as i')
                ->join('etudiant as e', 'i.matricule_etudiant', '=', 'e.matricule_etudiant')
                ->select(
                    'i.id_paiement',
                    'i.matricule_etudiant as matricule',
                    DB::raw("CONCAT(e.nom_etudiant,' ',e.prenom_etudiant) as nom_complet"),
                    'i.code_session',
                    'i.date_paiement',
                    'i.montant_paye',
                    'i.reste_a_payer as reste'
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
                'dernieres_inscriptions' => $dernieres,
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

    public function charts()
    {
        try {
            // Revenus par mois (année en cours)
            $revenus = DB::table('inscription')
                ->selectRaw("DATE_FORMAT(date_paiement, '%b') as mois,
                             MONTH(date_paiement) as num_mois,
                             SUM(montant_paye) as revenus")
                ->whereYear('date_paiement', now()->year)
                ->whereNotNull('date_paiement')
                ->groupByRaw("MONTH(date_paiement), DATE_FORMAT(date_paiement, '%b')")
                ->orderByRaw("MONTH(date_paiement)")
                ->get();

            // Inscriptions par mois (année en cours)
            $inscriptions = DB::table('inscription')
                ->selectRaw("DATE_FORMAT(date_paiement, '%b') as mois,
                             MONTH(date_paiement) as num_mois,
                             COUNT(*) as count")
                ->whereYear('date_paiement', now()->year)
                ->whereNotNull('date_paiement')
                ->groupByRaw("MONTH(date_paiement), DATE_FORMAT(date_paiement, '%b')")
                ->orderByRaw("MONTH(date_paiement)")
                ->get();

            // Répartition par lieu de paiement
            $lieux = DB::table('inscription')
                ->selectRaw('lieu_paiement as name, COUNT(*) as value')
                ->whereNotNull('lieu_paiement')
                ->where('lieu_paiement', '!=', '')
                ->groupBy('lieu_paiement')
                ->orderByRaw('COUNT(*) DESC')
                ->get();

            return response()->json([
                'revenus'      => $revenus,
                'inscriptions' => $inscriptions,
                'lieux'        => $lieux,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'revenus'      => [],
                'inscriptions' => [],
                'lieux'        => [],
                'error'        => $e->getMessage(),
            ]);
        }
    }
}