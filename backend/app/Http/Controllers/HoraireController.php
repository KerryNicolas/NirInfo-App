<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class HoraireController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('horaire as h')
            ->leftJoin('salarie as s', 'h.matricule_s', '=', 's.matricule_s')
            ->select(
                'h.code_horaire',
                'h.designation',
                'h.horaire',
                'h.remarque',
                DB::raw("CONCAT(s.nom, ' ', s.prenom) as editeur")
            )
            ->orderBy('h.code_horaire', 'ASC');

        if ($request->has('search') && $request->search) {
            $s = $request->search;
            $query->where(function ($q) use ($s) {
                $q->where('h.code_horaire', 'like', "%$s%")
                  ->orWhere('h.designation', 'like', "%$s%");
            });
        }

        $horaires = $query->get();
        return response()->json(['data' => $horaires, 'total' => $horaires->count()]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'code_horaire' => 'required|string|unique:horaire,code_horaire',
            'designation'  => 'required|string',
            'horaire'      => 'required|string',
            'remarque'     => 'nullable|string',
        ]);

        DB::table('horaire')->insert([
            'code_horaire' => $request->code_horaire,
            'designation'  => $request->designation,
            'horaire'      => $request->horaire,
            'remarque'     => $request->remarque ?? '',
        ]);

        return response()->json(['message' => 'Horaire créé avec succès'], 201);
    }

    public function show($id)
    {
        $horaire = DB::table('horaire')->where('code_horaire', $id)->first();
        return response()->json($horaire);
    }

    public function update(Request $request, $id)
    {
        DB::table('horaire')->where('code_horaire', $id)->update([
            'designation' => $request->designation,
            'horaire'     => $request->horaire,
            'remarque'    => $request->remarque ?? '',
        ]);
        return response()->json(['message' => 'Horaire mis à jour avec succès']);
    }

    public function destroy($id)
    {
        DB::table('horaire')->where('code_horaire', $id)->delete();
        return response()->json(['message' => 'Horaire supprimé avec succès']);
    }
}
