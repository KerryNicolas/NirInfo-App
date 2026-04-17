<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FonctionController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('fonction')
            ->select('id_fonction', 'nom_fonction', 'description_fonction');

        // LIFO : id_fonction DESC
        return $this->paginate($query, $request,
            ['nom_fonction', 'description_fonction'],
            'id_fonction'
        );
    }

    public function store(Request $request)
    {
        $request->validate(['nom_fonction' => 'required|string|max:255']);

        $id = DB::table('fonction')->insertGetId([
            'nom_fonction'         => $request->nom_fonction,
            'description_fonction' => $request->description_fonction ?? null,
            'matricule_s'          => null,
        ]);

        return $this->ok('Fonction enregistrée', ['id_fonction' => $id], 201);
    }

    public function show($id)
    {
        $f = DB::table('fonction')->where('id_fonction', $id)->first();
        if (!$f) return $this->err('Non trouvé', 404);
        return response()->json($f);
    }

    public function update(Request $request, $id)
    {
        $request->validate(['nom_fonction' => 'required|string|max:255']);

        DB::table('fonction')->where('id_fonction', $id)->update([
            'nom_fonction'         => $request->nom_fonction,
            'description_fonction' => $request->description_fonction ?? null,
        ]);

        return $this->ok('Fonction modifiée');
    }

    public function destroy($id)
    {
        $count = DB::table('personnel')->where('id_fonction', $id)->count();
        if ($count > 0) return $this->err("Impossible : $count personnel(s) utilisent cette fonction.", 422);

        DB::table('fonction')->where('id_fonction', $id)->delete();
        return $this->ok('Fonction supprimée');
    }
}