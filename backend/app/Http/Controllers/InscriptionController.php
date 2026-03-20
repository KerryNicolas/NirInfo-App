<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InscriptionController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('inscription as i')
            ->join('etudiant as e', 'i.matricule', '=', 'e.matricule')
            ->leftJoin('session as s', 'i.code_session', '=', 's.code_session')
            ->leftJoin('salarie as sal', 'i.matricule_s', '=', 'sal.matricule_s')
            ->select(
                'i.id_paiement',
                'i.matricule',
                'e.nom',
                'e.prenom',
                'i.code_session',
                'i.date_paiement',
                'i.montant_paye',
                'i.reste',
                'i.compte',
                'i.lieu_paiement',
                DB::raw("CONCAT(sal.nom, ' ', sal.prenom, ' (', IFNULL(sal.matricule_s,''), ' - ', IFNULL(sal.telephone,''), ')') as editeur")
            )
            ->orderBy('i.id_paiement', 'DESC');

        if ($request->has('search') && $request->search) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('i.matricule', 'like', "%$s%")
                  ->orWhere('e.nom', 'like', "%$s%")
                  ->orWhere('i.code_session', 'like', "%$s%");
            });
        }

        $inscriptions = $query->get();
        return response()->json(['data' => $inscriptions, 'total' => $inscriptions->count()]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'matricule'     => 'required|string|exists:etudiant,matricule',
            'code_session'  => 'required|string|exists:session,code_session',
            'montant_paye'  => 'required|numeric',
            'compte'        => 'required|string',
            'lieu_paiement' => 'required|string',
        ]);

        // Get session frais
        $session = DB::table('session')->where('code_session', $request->code_session)->first();
        $frais = $session ? floatval($session->frais_formation) : 0;
        $reste = $frais - floatval($request->montant_paye);

        DB::table('inscription')->insert([
            'matricule'      => $request->matricule,
            'code_session'   => $request->code_session,
            'date_paiement'  => $request->date_paiement ?? now()->toDateString(),
            'montant_paye'   => $request->montant_paye,
            'reste'          => max(0, $reste),
            'compte'         => $request->compte,
            'lieu_paiement'  => $request->lieu_paiement,
        ]);

        return response()->json(['message' => 'Inscription créée avec succès'], 201);
    }

    public function destroy($id)
    {
        DB::table('inscription')->where('id_paiement', $id)->delete();
        return response()->json(['message' => 'Inscription supprimée avec succès']);
    }

    public function show($id)
    {
        $inscription = DB::table('inscription')->where('id_paiement', $id)->first();
        return response()->json($inscription);
    }

    public function update(Request $request, $id)
    {
        DB::table('inscription')->where('id_paiement', $id)->update([
            'montant_paye'  => $request->montant_paye,
            'reste'         => $request->reste ?? 0,
            'compte'        => $request->compte,
            'lieu_paiement' => $request->lieu_paiement,
        ]);
        return response()->json(['message' => 'Inscription mise à jour']);
    }
}
