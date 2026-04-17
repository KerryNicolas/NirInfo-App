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
        // LIFO par code_horaire
        return $this->paginate($query, $request,
            ['h.code_horaire','h.designation_horaire'],
            'h.code_horaire'
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
        $request->validate(['designation'=>'required|string|max:255']);
        DB::table('horaire')->where('code_horaire',$id)->update([
            'designation_horaire' => $request->designation,
            'description_horaire' => $request->horaire  ?? '',
            'remarque_horaire'    => $request->remarque ?? '',
        ]);
        return $this->ok('Horaire mis à jour avec succès');
    }

    public function destroy($id)
    {
        DB::table('horaire')->where('code_horaire',$id)->delete();
        return $this->ok('Horaire supprimé avec succès');
    }
}