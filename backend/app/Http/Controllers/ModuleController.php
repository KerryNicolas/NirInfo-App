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
        $request->validate(['nom' => 'required|string|max:255']);
        DB::table('module')->where('code_module', $id)->update([
            'nom_module'         => $request->nom,
            'description_module' => $request->description ?? '',
        ]);
        return $this->ok('Module mis à jour avec succès');
    }

    public function destroy($id)
    {
        DB::table('module')->where('code_module', $id)->delete();
        return $this->ok('Module supprimé avec succès');
    }
}