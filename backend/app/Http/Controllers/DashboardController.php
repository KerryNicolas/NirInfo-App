<?php
namespace App\Http\Controllers;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function stats()
    {
        try {
            // FIX PERFORMANCE : whereMonth()/whereYear() appliquent une fonction
            // SQL sur la colonne date_paiement, ce qui empêche MySQL d'utiliser
            // un index dessus (obligé de scanner toute la table ligne par ligne
            // pour évaluer MONTH()/YEAR() sur chaque ligne). Une comparaison de
            // plage (>= début du mois, < début du mois suivant) permet à MySQL
            // d'utiliser un index normal sur date_paiement — bien plus rapide
            // si la table inscription contient beaucoup de lignes.
            $debutMois  = Carbon::now()->startOfMonth()->toDateString();
            $finMois    = Carbon::now()->addMonthNoOverflow()->startOfMonth()->toDateString();

            $totalEtudiants  = DB::table('etudiant')->count();

            $sessionsActives = DB::table('session')
                                  ->where('fin_session', '>=', now()->toDateString())
                                  ->count();

            // FIX : count + sum du mois fusionnés en UNE seule requête au lieu
            // de deux — un seul aller-retour SQL au lieu de deux pour la même
            // plage de lignes.
            $moisAgg = DB::table('inscription')
                ->where('date_paiement', '>=', $debutMois)
                ->where('date_paiement', '<',  $finMois)
                ->selectRaw('COUNT(*) as inscriptions_mois, COALESCE(SUM(montant_paye),0) as revenus_mois')
                ->first();

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
                    'inscriptions_mois' => $moisAgg->inscriptions_mois ?? 0,
                    'revenus_mois'      => $moisAgg->revenus_mois ?? 0,
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