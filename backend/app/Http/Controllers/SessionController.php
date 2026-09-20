<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SessionController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('session as s')
            ->leftJoin('module as m',    's.code_module',   '=','m.code_module')
            ->leftJoin('horaire as h',   's.code_horaire',  '=','h.code_horaire')
            ->leftJoin('salarie as ed',  's.matricule_s',   '=','ed.matricule_s')
            ->leftJoin('formateur as f', 's.matricule_f',   '=','f.matricule_f')
            ->leftJoin('personnel as p', 'f.matricule_pers','=','p.matricule_pers')
            ->leftJoin(DB::raw('(
                SELECT code_session, lieu_paiement, COUNT(*) as cnt
                FROM inscription GROUP BY code_session, lieu_paiement
            ) as lieux'), function($j){ $j->on('s.code_session','=','lieux.code_session'); })
            ->select(
                's.id',
                's.code_session',
                's.debut_session  as date_debut',
                's.fin_session    as date_fin',
                's.echeance       as date_echeance',
                's.frais_module   as frais_formation',
                's.code_module',
                's.code_horaire',
                'm.nom_module          as module_nom',
                'h.designation_horaire as horaire_designation',
                'h.description_horaire as horaire_description',
                DB::raw("COALESCE(
                    NULLIF(s.lieu,''),
                    CONCAT(UCASE(LEFT(IFNULL(lieux.lieu_paiement,''),1)), LOWER(SUBSTRING(IFNULL(lieux.lieu_paiement,''),2)))
                ) as lieu"),
                DB::raw("CONCAT(IFNULL(ed.nom_s,''),' ',IFNULL(ed.prenom_s,'')) as editeur"),
                DB::raw("CONCAT(IFNULL(p.nom_pers,''),' ',IFNULL(p.prenom_pers,'')) as formateur_nom")
            );

        if ($request->boolean('only_active')) {
            $query->where('s.fin_session', '>=', now()->toDateString());
        }

        $result  = $this->paginate($query, $request, ['s.code_session','m.nom_module'], 's.id');
        $decoded = json_decode($result->getContent(), true);
        $decoded['data'] = collect($decoded['data'])->unique('code_session')->values()->all();
        return response()->json($decoded);
    }

    public function enCours(Request $request)
    {
        try {
            $query = DB::table('session as s')
                ->leftJoin('module as m',    's.code_module',   '=','m.code_module')
                ->leftJoin('horaire as h',   's.code_horaire',  '=','h.code_horaire')
                ->leftJoin('formateur as f', 's.matricule_f',   '=','f.matricule_f')
                ->leftJoin('personnel as p', 'f.matricule_pers','=','p.matricule_pers')
                ->leftJoin(DB::raw('(SELECT code_session, COUNT(*) as nb_inscrits FROM inscription GROUP BY code_session) as ins'),
                    's.code_session','=','ins.code_session')
                ->where('s.fin_session','>=',now()->toDateString())
                ->select(
                    's.code_session',
                    's.debut_session  as date_debut',
                    's.fin_session    as date_fin',
                    's.echeance       as date_echeance',
                    's.frais_module   as frais_formation',
                    'm.nom_module     as module_nom',
                    'h.description_horaire as horaire_description',
                    DB::raw('IFNULL(ins.nb_inscrits,0) as nb_inscrits'),
                    DB::raw("CONCAT(IFNULL(p.nom_pers,''),' ',IFNULL(p.prenom_pers,'')) as formateur_nom")
                )
                ->orderBy('s.debut_session','DESC');

            if ($request->filled('module') && $request->module !== 'Tous')
                $query->where('s.code_module',$request->module);

            return response()->json(['data'=>$query->get()]);
        } catch (\Exception $e) {
            return response()->json(['data'=>[],'error'=>$e->getMessage()],500);
        }
    }

    public function store(Request $request)
    {
        $request->validate([
            'date_debut'      => 'required|date',
            'date_fin'        => 'required|date',
            'code_horaire'    => 'required|string|exists:horaire,code_horaire',
            'code_module'     => 'required|string|exists:module,code_module',
            'frais_formation' => 'required|numeric|min:0',
        ]);
        $code = $request->code_module.' du '.$request->date_debut.' '.$request->code_horaire;
        $mf   = null;
        if ($request->filled('id_formateur')) {
            $f  = DB::table('formateur')->where('id_formateur',$request->id_formateur)->first();
            $mf = $f?->matricule_f;
        }
        DB::table('session')->insert([
            'code_session'  => $code,
            'debut_session' => $request->date_debut,
            'fin_session'   => $request->date_fin,
            'echeance'      => $request->date_echeance ?? null,
            'code_horaire'  => $request->code_horaire,
            'code_module'   => $request->code_module,
            'frais_module'  => $request->frais_formation,
            'lieu'          => $request->lieu ?? null,
            'matricule_f'   => $mf,
            'matricule_s'   => auth()->user()->matricule ?? null,
        ]);
        return $this->ok('Session créée avec succès', ['code_session'=>$code], 201);
    }

    public function show($id)
    {
        $s = DB::table('session')->where('code_session',$id)->first();
        if (!$s) return $this->err('Session non trouvée', 404);
        return response()->json($s);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'date_debut'      => 'sometimes|required|date',
            'date_fin'        => 'sometimes|required|date',
            'code_horaire'    => 'sometimes|required|string|exists:horaire,code_horaire',
            'code_module'     => 'sometimes|required|string|exists:module,code_module',
            'frais_formation' => 'sometimes|required|numeric|min:0',
            'lieu'            => 'sometimes|nullable|string|max:100',
        ]);

        $data = array_filter([
            'debut_session' => $request->date_debut,
            'fin_session'   => $request->date_fin,
            'echeance'      => $request->has('date_echeance') ? $request->date_echeance : null,
            'frais_module'  => $request->frais_formation,
            'code_horaire'  => $request->code_horaire,
            'code_module'   => $request->code_module,
            'lieu'          => $request->has('lieu') ? $request->lieu : null,
        ], fn($v) => $v !== null);

        DB::table('session')->where('code_session',$id)->update($data);
        return $this->ok('Session mise à jour avec succès');
    }

    public function destroy($id)
    {
        DB::table('session')->where('code_session',$id)->delete();
        return $this->ok('Session supprimée avec succès');
    }
}