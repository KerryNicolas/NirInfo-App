<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class EtudiantController extends Controller
{
    public function index(Request $request)
    {
        $query = DB::table('etudiant as e')
            ->leftJoin('salarie as s', 'e.matricule_s', '=', 's.matricule_s')
            ->select(
                'e.matricule',
                'e.nom',
                'e.prenom',
                'e.sexe',
                'e.date_naissance',
                'e.lieu_naissance',
                'e.numero_cin',
                'e.date_cin',
                'e.lieu_cin',
                'e.telephone',
                'e.email',
                'e.photo',
                DB::raw("CONCAT(s.nom, ' ', s.prenom, ' (', IFNULL(s.matricule_s,''), ' - ', IFNULL(s.telephone,''), ')') as editeur")
            )
            ->orderBy('e.matricule', 'DESC');

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('e.nom', 'like', "%$search%")
                  ->orWhere('e.prenom', 'like', "%$search%")
                  ->orWhere('e.matricule', 'like', "%$search%")
                  ->orWhere('e.telephone', 'like', "%$search%");
            });
        }

        $etudiants = $query->get();

        // Add photo URL
        $etudiants = $etudiants->map(function ($e) {
            if ($e->photo) {
                $e->photo_url = url('storage/photos/' . $e->photo);
            } else {
                $e->photo_url = null;
            }
            return $e;
        });

        return response()->json(['data' => $etudiants, 'total' => $etudiants->count()]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'nom'    => 'required|string',
            'prenom' => 'required|string',
            'sexe'   => 'required|in:HOMME,FEMME',
        ]);

        // Generate matricule
        $last = DB::table('etudiant')->orderBy('matricule', 'DESC')->first();
        $nextNum = 1;
        if ($last) {
            preg_match('/\d+/', $last->matricule, $matches);
            $nextNum = intval($matches[0]) + 1;
        }
        $matricule = 'NI-' . str_pad($nextNum, 4, '0', STR_PAD_LEFT);

        DB::table('etudiant')->insert([
            'matricule'      => $matricule,
            'nom'            => strtoupper($request->nom),
            'prenom'         => $request->prenom,
            'sexe'           => $request->sexe,
            'date_naissance' => $request->date_naissance,
            'lieu_naissance' => $request->lieu_naissance ?? '',
            'numero_cin'     => $request->numero_cin ?? '',
            'date_cin'       => $request->date_cin,
            'lieu_cin'       => $request->lieu_cin ?? '',
            'telephone'      => $request->telephone ?? '',
            'email'          => $request->email ?? '',
            'photo'          => '',
        ]);

        return response()->json(['message' => 'Étudiant créé avec succès', 'matricule' => $matricule], 201);
    }

    public function show($id)
    {
        $e = DB::table('etudiant')->where('matricule', $id)->first();
        if (!$e) return response()->json(['message' => 'Étudiant non trouvé'], 404);
        if ($e->photo) {
            $e->photo_url = url('storage/photos/' . $e->photo);
        }
        return response()->json($e);
    }

    public function update(Request $request, $id)
    {
        DB::table('etudiant')->where('matricule', $id)->update([
            'nom'            => strtoupper($request->nom),
            'prenom'         => $request->prenom,
            'sexe'           => $request->sexe,
            'date_naissance' => $request->date_naissance,
            'lieu_naissance' => $request->lieu_naissance ?? '',
            'numero_cin'     => $request->numero_cin ?? '',
            'date_cin'       => $request->date_cin,
            'lieu_cin'       => $request->lieu_cin ?? '',
            'telephone'      => $request->telephone ?? '',
            'email'          => $request->email ?? '',
        ]);

        return response()->json(['message' => 'Étudiant mis à jour avec succès']);
    }

    public function destroy($id)
    {
        DB::table('etudiant')->where('matricule', $id)->delete();
        return response()->json(['message' => 'Étudiant supprimé avec succès']);
    }

    public function uploadPhoto(Request $request, $id)
    {
        $request->validate(['photo' => 'required|image|max:2048']);

        $filename = time() . '.' . $request->photo->extension();
        $request->photo->storeAs('public/photos', $filename);

        DB::table('etudiant')->where('matricule', $id)->update(['photo' => $filename]);

        return response()->json([
            'message'   => 'Photo mise à jour',
            'photo_url' => url('storage/photos/' . $filename),
        ]);
    }
}
