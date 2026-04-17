<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FactureController extends Controller
{
    public function generate(Request $request)
    {
        $request->validate([
            'matricule'     => 'required|string',
            'code_session'  => 'required|string',
            'date_paiement' => 'nullable',
        ]);

        // Etudiant
        $etudiant = DB::table('etudiant')
            ->where('matricule_etudiant', $request->matricule)
            ->first();
        if (!$etudiant) {
            return response()->json(['message' => 'Étudiant non trouvé'], 404);
        }

        // Session + module + horaire
        $session = DB::table('session as s')
            ->join('module as m',  's.code_module',  '=', 'm.code_module')
            ->leftJoin('horaire as h', 's.code_horaire', '=', 'h.code_horaire')
            ->where('s.code_session', $request->code_session)
            ->select(
                's.*',
                'm.nom_module            as module_nom',
                'h.description_horaire   as horaire_desc'
            )
            ->first();
        if (!$session) {
            return response()->json(['message' => 'Session non trouvée'], 404);
        }

        // Inscription (dernier paiement ou celui de la date)
        $inscriptionQuery = DB::table('inscription')
            ->where('matricule_etudiant', $request->matricule)
            ->where('code_session', $request->code_session);

        if ($request->filled('date_paiement')) {
            $inscriptionQuery->whereDate('date_paiement', $request->date_paiement);
        }

        $inscription = $inscriptionQuery->orderBy('id_paiement', 'DESC')->first();
        if (!$inscription) {
            return response()->json(['message' => 'Inscription / paiement non trouvé'], 404);
        }

        $numero    = str_pad($inscription->id_paiement, 6, '0', STR_PAD_LEFT);
        $reference = 'FAC-' . date('Y') . '-' . $numero;

        return response()->json([
            'reference'   => $reference,
            'numero'      => $numero,
            'date_facture'=> now()->format('d/m/Y'),
            'etudiant'    => [
                'matricule' => $etudiant->matricule_etudiant,
                'nom'       => $etudiant->nom_etudiant,
                'prenom'    => $etudiant->prenom_etudiant,
                'telephone' => $etudiant->tel_etudiant,
                'email'     => $etudiant->mail_etudiant,
            ],
            'session'     => [
                'code_session'    => $session->code_session,
                'module_nom'      => $session->module_nom,
                'date_debut'      => $session->debut_session,
                'date_fin'        => $session->fin_session,
                'frais_formation' => $session->frais_module,
                'lieu'            => '—',
                'horaire_desc'    => $session->horaire_desc ?? '—',
            ],
            'inscription' => [
                'montant_paye'  => $inscription->montant_paye,
                'reste'         => $inscription->reste_a_payer,
                'date_paiement' => $inscription->date_paiement,
                'compte'        => $inscription->type_paiement,
            ],
            'centre' => [
                'nom'     => "Nir'Info",
                'adresse' => 'LOT IIA 80 C Ampandrana Ouest, Antananarivo 101',
                'tel'     => 'Tél: 034 36 176 60 – 034 77 775 34',
                'email'   => 'admin@nir-info.mg',
            ],
        ]);
    }
}