<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SessionController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('session as s')
            ->leftJoin('module as m', 's.code_module', '=', 'm.code_module')
            ->leftJoin('horaire as h', 's.code_horaire', '=', 'h.code_horaire')
            ->leftJoin('salarie as ed', 's.matricule_s', '=', 'ed.matricule_s')
            ->leftJoin('formateur as f', 's.id_formateur', '=', 'f.id_formateur')
            ->select(
                's.*',
                'm.nom as module_nom',
                'h.designation as horaire_designation',
                'h.horaire as horaire_description',
                DB::raw("CONCAT(ed.nom, ' ', ed.prenom, ' (', IFNULL(ed.matricule_s,''), ' - ', IFNULL(ed.telephone,''), ')') as editeur"),
                DB::raw("CONCAT(f.nom, ' ', f.prenom, ' (', IFNULL(f.id_formateur,''), ' - ', IFNULL(f.telephone,''), ')') as formateur_nom")
            )
            ->orderBy('s.date_debut', 'DESC');

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('s.code_session', 'like', "%$search%")
                  ->orWhere('m.nom', 'like', "%$search%");
            });
        }

        $sessions = $query->get();

        return response()->json([
            'data'  => $sessions,
            'total' => $sessions->count(),
        ]);
    }

    public function enCours(Request $request)
    {
        $query = DB::table('session as s')
            ->leftJoin('module as m', 's.code_module', '=', 'm.code_module')
            ->leftJoin('horaire as h', 's.code_horaire', '=', 'h.code_horaire')
            ->leftJoin('salarie as ed', 's.matricule_s', '=', 'ed.matricule_s')
            ->leftJoin('formateur as f', 's.id_formateur', '=', 'f.id_formateur')
            ->leftJoin(DB::raw('(SELECT code_session, COUNT(*) as nb_inscrits FROM inscription GROUP BY code_session) as ins'), 's.code_session', '=', 'ins.code_session')
            ->where('s.date_fin', '>=', now()->toDateString())
            ->select(
                's.*',
                'm.nom as module_nom',
                'h.designation as horaire_designation',
                'h.horaire as horaire_description',
                DB::raw('IFNULL(ins.nb_inscrits, 0) as nb_inscrits'),
                DB::raw("CONCAT(ed.nom, ' ', ed.prenom, ' (', IFNULL(ed.matricule_s,''), ' - ', IFNULL(ed.telephone,''), ')') as editeur"),
                DB::raw("CONCAT(f.nom, ' ', f.prenom, ' (', IFNULL(f.id_formateur,''), ' - ', IFNULL(f.telephone,''), ')') as formateur_nom")
            )
            ->orderBy('s.date_debut', 'DESC');

        if ($request->has('lieu') && $request->lieu !== 'Tous') {
            $query->where('s.lieu', $request->lieu);
        }

        if ($request->has('module') && $request->module !== 'Tous') {
            $query->where('s.code_module', $request->module);
        }

        $sessions = $query->get();

        return response()->json([
            'data'       => $sessions,
            'total'      => $sessions->count(),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'date_debut'      => 'required|date',
            'date_fin'        => 'required|date',
            'date_echeance'   => 'required|date',
            'code_horaire'    => 'required|string',
            'code_module'     => 'required|string',
            'frais_formation' => 'required|numeric',
            'lieu'            => 'required|string',
            'id_formateur'    => 'required|integer',
        ]);

        // Generate code_session
        $module = DB::table('module')->where('code_module', $request->code_module)->first();
        $moduleNom = $module ? strtolower(str_replace(' ', '', substr($module->nom, 0, 8))) : $request->code_module;
        $horaire = DB::table('horaire')->where('code_horaire', $request->code_horaire)->first();
        $horaireCourt = $horaire ? $request->code_horaire : 'XX';
        $lieu = str_replace(' ', '', substr($request->lieu, 0, 3));

        $codeSession = "{$moduleNom} du {$request->date_debut} {$horaireCourt} {$lieu}";

        DB::table('session')->insert([
            'code_session'    => $codeSession,
            'date_debut'      => $request->date_debut,
            'date_fin'        => $request->date_fin,
            'date_echeance'   => $request->date_echeance,
            'code_horaire'    => $request->code_horaire,
            'code_module'     => $request->code_module,
            'frais_formation' => $request->frais_formation,
            'lieu'            => $request->lieu,
            'id_formateur'    => $request->id_formateur,
        ]);

        return response()->json(['message' => 'Session créée avec succès', 'code_session' => $codeSession], 201);
    }

    public function show($id)
    {
        $session = DB::table('session')->where('code_session', $id)->first();
        if (!$session) {
            return response()->json(['message' => 'Session non trouvée'], 404);
        }
        return response()->json($session);
    }

    public function destroy($id)
    {
        DB::table('session')->where('code_session', $id)->delete();
        return response()->json(['message' => 'Session supprimée avec succès']);
    }

    public function update(Request $request, $id)
    {
        DB::table('session')->where('code_session', $id)->update([
            'date_debut'      => $request->date_debut,
            'date_fin'        => $request->date_fin,
            'date_echeance'   => $request->date_echeance,
            'frais_formation' => $request->frais_formation,
        ]);
        return response()->json(['message' => 'Session mise à jour avec succès']);
    }
}
