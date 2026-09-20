<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HoraireController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('horaire as h')
            ->leftJoin('salarie as s','h.matricule_s','=','s.matricule_s')
            ->select(
                'h.code_horaire',
                'h.designation_horaire as designation',
                'h.description_horaire as horaire',
                'h.remarque_horaire    as remarque',
                DB::raw("CONCAT(IFNULL(s.nom_s,''),' ',IFNULL(s.prenom_s,'')) as editeur")
            );
        // LIFO : h.id DESC (le plus récent en premier) — code_horaire donnait
        // un tri alphabétique, pas l'ordre de création réel.
        return $this->paginate($query, $request,
            ['h.code_horaire','h.designation_horaire'],
            'h.id'
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'code_horaire' => 'required|string|max:10|unique:horaire,code_horaire',
            'designation'  => 'required|string|max:255',
        ]);
        DB::table('horaire')->insert([
            'code_horaire'        => strtoupper(trim($request->code_horaire)),
            'designation_horaire' => $request->designation,
            'description_horaire' => $request->horaire  ?? '',
            'remarque_horaire'    => $request->remarque ?? '',
            // ── FIX : capture de l'éditeur, absente jusqu'ici ──
            'matricule_s'         => auth()->user()->matricule ?? null,
        ]);
        return $this->ok('Horaire créé avec succès', [], 201);
    }

    public function show($id)
    {
        $h = DB::table('horaire')->where('code_horaire',$id)
            ->select('code_horaire','designation_horaire as designation',
                     'description_horaire as horaire','remarque_horaire as remarque')
            ->first();
        if (!$h) return $this->err('Non trouvé', 404);
        return response()->json($h);
    }

    public function update(Request $request, $id)
    {
        // FIX : code_horaire devient modifiable, même principe que pour
        // ModuleController::update() — unique() exclut la ligne en cours,
        // et si le code change réellement, session.code_horaire (référence
        // confirmée en base) est mis à jour dans la même transaction pour
        // ne pas rendre orphelines les sessions existantes.
        $request->validate([
            'designation'  => 'required|string|max:255',
            'code_horaire' => 'sometimes|required|string|max:10|unique:horaire,code_horaire,' . $id . ',code_horaire',
        ]);

        $data = [
            'designation_horaire' => $request->designation,
            'description_horaire' => $request->horaire  ?? '',
            'remarque_horaire'    => $request->remarque ?? '',
        ];

        $newCode = $id;

        if ($request->filled('code_horaire')) {
            $normalized = strtoupper(trim($request->code_horaire));
            if ($normalized !== $id) {
                $data['code_horaire'] = $normalized;
                $newCode = $normalized;

                DB::transaction(function () use ($id, $normalized, $data) {
                    DB::table('session')->where('code_horaire', $id)
                        ->update(['code_horaire' => $normalized]);
                    DB::table('horaire')->where('code_horaire', $id)->update($data);
                });

                return $this->ok('Horaire mis à jour avec succès', ['code_horaire' => $newCode]);
            }
        }

        DB::table('horaire')->where('code_horaire', $id)->update($data);

        return $this->ok('Horaire mis à jour avec succès', ['code_horaire' => $newCode]);
    }

    public function destroy($id)
    {
        DB::table('horaire')->where('code_horaire',$id)->delete();
        return $this->ok('Horaire supprimé avec succès');
    }
}