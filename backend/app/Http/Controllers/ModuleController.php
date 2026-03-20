<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ModuleController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('module as m')
            ->leftJoin('salarie as s', 'm.matricule_s', '=', 's.matricule_s')
            ->select(
                'm.code_module',
                'm.nom',
                'm.description',
                DB::raw("CONCAT(s.nom, ' ', s.prenom, ' (', s.matricule_s, ' - ', s.telephone, ')') as editeur")
            );

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('m.code_module', 'like', "%$search%")
                  ->orWhere('m.nom', 'like', "%$search%")
                  ->orWhere('m.description', 'like', "%$search%");
            });
        }

        $modules = $query->orderBy('m.code_module', 'ASC')->get();

        return response()->json([
            'data'  => $modules,
            'total' => $modules->count(),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'code_module' => 'required|string|unique:module,code_module',
            'nom'         => 'required|string',
            'description' => 'nullable|string',
        ]);

        DB::table('module')->insert([
            'code_module' => $request->code_module,
            'nom'         => $request->nom,
            'description' => $request->description ?? '',
        ]);

        return response()->json(['message' => 'Module créé avec succès'], 201);
    }

    public function show($id)
    {
        $module = DB::table('module')->where('code_module', $id)->first();
        if (!$module) {
            return response()->json(['message' => 'Module non trouvé'], 404);
        }
        return response()->json($module);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'nom'         => 'required|string',
            'description' => 'nullable|string',
        ]);

        DB::table('module')->where('code_module', $id)->update([
            'nom'         => $request->nom,
            'description' => $request->description ?? '',
        ]);

        return response()->json(['message' => 'Module mis à jour avec succès']);
    }

    public function destroy($id)
    {
        DB::table('module')->where('code_module', $id)->delete();
        return response()->json(['message' => 'Module supprimé avec succès']);
    }
}
