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

            // Filtres
            if ($request->filled('date_debut'))
                $query->whereDate('i.date_paiement', '>=', $request->date_debut);
            if ($request->filled('date_fin'))
                $query->whereDate('i.date_paiement', '<=', $request->date_fin);
            if ($request->filled('module') && $request->module !== '')
                $query->where('i.code_session', 'like', '%' . $request->module . '%');
            if ($request->filled('lieu') && $request->lieu !== 'Tous')
                $query->where('i.lieu_paiement', $request->lieu);

            // Calculer le total AVANT pagination (sur toute la sélection filtrée)
            $totalMontant = (clone $query)->sum('i.montant_paye');

            // LIFO : id_paiement DESC
            $result  = $this->paginate($query, $request, ['e.nom_etudiant','e.prenom_etudiant','i.matricule_etudiant','i.code_session'], 'i.id_paiement');
            $decoded = json_decode($result->getContent(), true);

            // Injecter le total_montant dans la réponse
            $decoded['total_montant'] = $totalMontant;

            return response()->json($decoded);
        } catch (\Exception $e) {
            return response()->json(['data' => [], 'total' => 0, 'total_montant' => 0, 'error' => $e->getMessage()], 500);
        }
    }
}