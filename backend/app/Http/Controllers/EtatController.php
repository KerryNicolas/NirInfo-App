<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EtatController extends BaseApiController
{
    public function index(Request $request)
    {
        try {
            $query = DB::table('inscription as i')
                ->join('etudiant as e',     'i.matricule_etudiant', '=', 'e.matricule_etudiant')
                ->leftJoin('salarie as s',  'i.matricule_s',        '=', 's.matricule_s')
                ->select(
                    'i.id_paiement',
                    'i.date_paiement      as date_transaction',
                    'i.matricule_etudiant as matricule',
                    'e.nom_etudiant       as nom',
                    'e.prenom_etudiant    as prenom',
                    'i.code_session',
                    'i.montant_paye       as montant',
                    'i.type_paiement',
                    'i.lieu_paiement',
                    DB::raw("CONCAT(IFNULL(s.nom_s,''),' ',IFNULL(s.prenom_s,'')) as editeur")
                );

            if ($request->filled('date_debut'))
                $query->whereDate('i.date_paiement', '>=', $request->date_debut);
            if ($request->filled('date_fin'))
                $query->whereDate('i.date_paiement', '<=', $request->date_fin);
            if ($request->filled('module') && $request->module !== '')
                $query->where('i.code_session', 'like', '%' . $request->module . '%');
            if ($request->filled('lieu') && $request->lieu !== 'Tous')
                $query->where('i.lieu_paiement', $request->lieu);

            // FIX PERFORMANCE (côté frontend, ce qui rendait /etat "lent") :
            // avant, EtatPage.tsx appelait CETTE route DEUX FOIS à chaque clic
            // sur "Valider" — une fois via useTable() (pagination), une
            // deuxième fois manuellement, juste pour lire total_montant, avec
            // exactement les mêmes filtres. Le endpoint ci-dessous n'a pas
            // changé : il continue de tout renvoyer en UNE réponse (données
            // paginées + total_montant) — c'est le frontend qui, jusqu'ici,
            // n'exploitait pas ce champ et redemandait la même chose deux
            // fois. EtatPage.tsx a été corrigé pour ne plus faire qu'UN seul
            // appel réseau par recherche : ça divise par deux le nombre de
            // requêtes HTTP et de requêtes SQL exécutées par clic.
            //
            // Reste un point à vérifier côté base de données si /etat est
            // encore lent avec beaucoup de lignes dans `inscription` : des
            // index sur inscription.date_paiement, inscription.matricule_s,
            // inscription.matricule_etudiant, inscription.code_session,
            // inscription.lieu_paiement et etudiant.matricule_etudiant
            // accélèrent grandement ce JOIN + ces WHERE. Une simple
            // commande "SHOW INDEX FROM inscription;" permet de vérifier
            // ce qui existe déjà.
            $totalMontant = (clone $query)->sum('i.montant_paye');

            $result  = $this->paginate($query, $request, ['e.nom_etudiant','e.prenom_etudiant','i.matricule_etudiant','i.code_session'], 'i.id_paiement');
            $decoded = json_decode($result->getContent(), true);
            $decoded['total_montant'] = $totalMontant;

            return response()->json($decoded);
        } catch (\Exception $e) {
            return response()->json(['data' => [], 'total' => 0, 'total_montant' => 0, 'error' => $e->getMessage()], 500);
        }
    }
}