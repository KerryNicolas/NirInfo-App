<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EcheanceController extends BaseApiController
{
    public function index(Request $request)
    {
        try {
            $query = DB::table('inscription as i')
                ->join('etudiant as e',      'i.matricule_etudiant', '=', 'e.matricule_etudiant')
                ->join('session as s',       'i.code_session',       '=', 's.code_session')
                ->leftJoin('salarie as sal', 'i.matricule_s',        '=', 'sal.matricule_s')
                ->select(
                    'i.id_paiement',
                    's.echeance           as date_echeance',
                    'i.matricule_etudiant as matricule',
                    'e.nom_etudiant       as nom',
                    'e.prenom_etudiant    as prenom',
                    'i.code_session',
                    'i.montant_paye',
                    'i.reste_a_payer      as reste',
                    DB::raw("CONCAT(IFNULL(sal.nom_s,''),' ',IFNULL(sal.prenom_s,'')) as editeur")
                )
                ->where('i.reste_a_payer', '>', 0);

            if ($request->filled('date'))
                $query->whereDate('s.echeance', '<=', $request->date);

            // Total AVANT pagination
            $totalAPercevoir = (clone $query)->sum('i.reste_a_payer');

            // LIFO : id_paiement DESC
            $result  = $this->paginate($query, $request, ['e.nom_etudiant','e.prenom_etudiant','i.matricule_etudiant','i.code_session'], 'i.id_paiement');
            $decoded = json_decode($result->getContent(), true);

            $decoded['total_a_percevoir'] = $totalAPercevoir;

            return response()->json($decoded);
        } catch (\Exception $e) {
            return response()->json(['data' => [], 'total' => 0, 'total_a_percevoir' => 0, 'error' => $e->getMessage()], 500);
        }
    }
}