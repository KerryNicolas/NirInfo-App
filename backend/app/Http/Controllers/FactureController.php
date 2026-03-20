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
            'date_paiement' => 'nullable|date',
        ]);

        $etudiant = DB::table('etudiant')->where('matricule', $request->matricule)->first();
        if (!$etudiant) {
            return response()->json(['message' => 'Étudiant non trouvé'], 404);
        }

        $session = DB::table('session as s')
            ->join('module as m', 's.code_module', '=', 'm.code_module')
            ->leftJoin('horaire as h', 's.code_horaire', '=', 'h.code_horaire')
            ->where('s.code_session', $request->code_session)
            ->select('s.*', 'm.nom as module_nom', 'h.horaire as horaire_desc')
            ->first();

        if (!$session) {
            return response()->json(['message' => 'Session non trouvée'], 404);
        }

        $inscriptionQuery = DB::table('inscription')
            ->where('matricule', $request->matricule)
            ->where('code_session', $request->code_session);

        if ($request->date_paiement) {
            $inscriptionQuery->where('date_paiement', $request->date_paiement);
        }

        $inscription = $inscriptionQuery->orderBy('id_paiement', 'DESC')->first();

        if (!$inscription) {
            return response()->json(['message' => 'Inscription non trouvée'], 404);
        }

        $numero = str_pad($inscription->id_paiement, 6, '0', STR_PAD_LEFT);
        $reference = 'FAC-' . $numero;

        return response()->json([
            'reference'     => $reference,
            'numero'        => $numero,
            'etudiant'      => $etudiant,
            'session'       => $session,
            'inscription'   => $inscription,
            'date_facture'  => now()->toDateString(),
            'centre'        => [
                'nom'     => "Nir'Info",
                'adresse' => 'Ampandrana, Antananarivo',
                'tel'     => '+261 34 00 000 00',
                'email'   => 'contact@nirinfo.mg',
            ],
        ]);
    }
}
