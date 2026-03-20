<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RecouvrementController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('recouvrement as r')
            ->join('etudiant as e', 'r.matricule', '=', 'e.matricule')
            ->leftJoin('session as s', 'r.code_session', '=', 's.code_session')
            ->leftJoin('salarie as sal', 'r.matricule_s', '=', 'sal.matricule_s')
            ->select(
                'r.id_recouvrement',
                'r.matricule',
                'e.nom',
                'e.prenom',
                'r.code_session',
                'r.date_paiement',
                'r.montant_paye',
                'r.reste',
                'r.compte',
                'r.lieu_paiement',
                DB::raw("CONCAT(sal.nom, ' ', sal.prenom, ' (', IFNULL(sal.matricule_s,''), ' - ', IFNULL(sal.telephone,''), ')') as editeur")
            )
            ->orderBy('r.id_recouvrement', 'DESC');

        if ($request->has('search') && $request->search) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('r.matricule', 'like', "%$s%")
                  ->orWhere('e.nom', 'like', "%$s%")
                  ->orWhere('r.code_session', 'like', "%$s%");
            });
        }

        $recouvrements = $query->get();
        return response()->json(['data' => $recouvrements, 'total' => $recouvrements->count()]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'matricule'    => 'required|string',
            'code_session' => 'required|string',
            'montant_paye' => 'required|numeric',
        ]);

        // Find original inscription to get reste
        $inscription = DB::table('inscription')
            ->where('matricule', $request->matricule)
            ->where('code_session', $request->code_session)
            ->first();

        $resteAvant = $inscription ? floatval($inscription->reste) : 0;
        $nouveauReste = $resteAvant - floatval($request->montant_paye);

        DB::table('recouvrement')->insert([
            'matricule'     => $request->matricule,
            'code_session'  => $request->code_session,
            'date_paiement' => $request->date_paiement ?? now()->toDateString(),
            'montant_paye'  => $request->montant_paye,
            'reste'         => max(0, $nouveauReste),
            'compte'        => $request->compte ?? 'Caisse',
            'lieu_paiement' => $request->lieu_paiement ?? 'Ampandrana',
        ]);

        // Update reste in inscription table
        if ($inscription) {
            DB::table('inscription')
                ->where('matricule', $request->matricule)
                ->where('code_session', $request->code_session)
                ->update(['reste' => max(0, $nouveauReste)]);
        }

        return response()->json(['message' => 'Recouvrement enregistré avec succès'], 201);
    }

    public function show($id)
    {
        $r = DB::table('recouvrement')->where('id_recouvrement', $id)->first();
        return response()->json($r);
    }

    public function update(Request $request, $id)
    {
        DB::table('recouvrement')->where('id_recouvrement', $id)->update([
            'montant_paye' => $request->montant_paye,
            'reste'        => $request->reste ?? 0,
        ]);
        return response()->json(['message' => 'Recouvrement mis à jour']);
    }

    public function destroy($id)
    {
        DB::table('recouvrement')->where('id_recouvrement', $id)->delete();
        return response()->json(['message' => 'Recouvrement supprimé avec succès']);
    }
}
