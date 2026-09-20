<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ModuleController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('module as m')
            ->leftJoin('salarie as s', 'm.matricule_s', '=', 's.matricule_s')
            ->select(
                'm.id',
                'm.code_module',
                'm.nom_module         as nom',
                'm.description_module as description',
                DB::raw("CONCAT(IFNULL(s.nom_s,''),' ',IFNULL(s.prenom_s,'')) as editeur")
            );

        // LIFO : id DESC — le dernier ajouté en premier
        return $this->paginate($query, $request,
            ['m.code_module', 'm.nom_module', 'm.description_module'],
            'm.id'
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'code_module' => 'required|string|max:50|unique:module,code_module',
            'nom'         => 'required|string|max:255',
            'description' => 'nullable|string',
        ]);

        DB::table('module')->insert([
            'code_module'        => strtoupper(trim($request->code_module)),
            'nom_module'         => $request->nom,
            'description_module' => $request->description ?? '',
            // ── FIX : capture de l'éditeur, absente jusqu'ici ──
            'matricule_s'        => auth()->user()->matricule ?? null,
        ]);

        return $this->ok('Module créé avec succès', [], 201);
    }

    public function show($id)
    {
        $m = DB::table('module')->where('code_module', $id)
            ->select('code_module', 'nom_module as nom', 'description_module as description')
            ->first();
        if (!$m) return $this->err('Module non trouvé', 404);
        return response()->json($m);
    }

    public function update(Request $request, $id)
    {
        // FIX : code_module devient modifiable. "sometimes" — n'est validé que
        // si le champ est présent dans la requête ; unique() exclut la ligne
        // en cours (celle qu'on est en train de modifier) pour ne pas se
        // rejeter elle-même comme doublon.
        $request->validate([
            'nom'         => 'required|string|max:255',
            'code_module' => 'sometimes|required|string|max:50|unique:module,code_module,' . $id . ',code_module',
        ]);

        $data = [
            'nom_module'         => $request->nom,
            'description_module' => $request->description ?? '',
        ];

        $newCode = $id; // valeur retournée au frontend si pas de changement

        if ($request->filled('code_module')) {
            $normalized = strtoupper(trim($request->code_module));
            if ($normalized !== $id) {
                $data['code_module'] = $normalized;
                $newCode = $normalized;

                // FIX CRITIQUE : la table `session` référence code_module
                // (2671 lignes confirmées en base) — sans cette mise à jour,
                // renommer un module rendrait orphelines toutes ses sessions
                // existantes. Les deux mises à jour sont faites dans une
                // transaction : soit les deux réussissent, soit aucune.
                DB::transaction(function () use ($id, $normalized, $data) {
                    DB::table('session')->where('code_module', $id)
                        ->update(['code_module' => $normalized]);
                    DB::table('module')->where('code_module', $id)->update($data);
                });

                return $this->ok('Module mis à jour avec succès', ['code_module' => $newCode]);
            }
        }

        DB::table('module')->where('code_module', $id)->update($data);

        return $this->ok('Module mis à jour avec succès', ['code_module' => $newCode]);
    }

    public function destroy($id)
    {
        DB::table('module')->where('code_module', $id)->delete();
        return $this->ok('Module supprimé avec succès');
    }
}