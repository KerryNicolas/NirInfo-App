<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PersonnelController extends BaseApiController
{
    /* ── PERSONNEL ── */
    public function index(Request $request)
    {
        $query = DB::table('personnel as p')
            ->leftJoin('fonction as f','p.id_fonction','=','f.id_fonction')
            // FIX : jointure éditeur ajoutée — absente jusqu'ici
            ->leftJoin('users as u', 'p.matricule_s', '=', 'u.id')
            ->select(
                'p.matricule_pers','p.nom_pers','p.prenom_pers','p.ddn_pers',
                'p.cin_pers','p.tel_pers','p.email_pers','p.dembauche_pers',
                'p.salaire_pers','p.diplome_pers','p.adresse_pers','p.photo_pers',
                'p.id_fonction','f.nom_fonction',
                DB::raw("IFNULL(u.name,'') as editeur")
            );
        if ($request->filled('id_fonction'))
            $query->where('p.id_fonction',$request->id_fonction);

        return $this->paginate($query, $request,
            ['p.nom_pers','p.prenom_pers','p.matricule_pers','p.cin_pers'],
            'p.matricule_pers'
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'matricule_pers' => 'required|string|max:50|unique:personnel,matricule_pers',
            'nom_pers'       => 'required|string|max:255',
            'prenom_pers'    => 'required|string|max:255',
            'id_fonction'    => 'required|integer|exists:fonction,id_fonction',
        ]);
        DB::table('personnel')->insert([
            'matricule_pers'  => $request->matricule_pers,
            'nom_pers'        => $request->nom_pers,
            'prenom_pers'     => $request->prenom_pers,
            'ddn_pers'        => $request->ddn_pers        ?? null,
            'ldn_pers'        => $request->ldn_pers        ?? '',
            'cin_pers'        => $request->cin_pers        ?? '',
            'dcin_pers'       => $request->dcin_pers       ?? null,
            'lcin_pers'       => $request->lcin_pers       ?? '',
            'tel_pers'        => $request->tel_pers        ?? '',
            'email_pers'      => $request->email_pers      ?? '',
            'dembauche_pers'  => $request->dembauche_pers  ?? null,
            'salaire_pers'    => $request->salaire_pers    ?? 0,
            'diplome_pers'    => $request->diplome_pers    ?? '',
            'adresse_pers'    => $request->adresse_pers    ?? '',
            'id_fonction'     => $request->id_fonction,
            'photo_pers'      => '',
            // FIX : capture de l'éditeur, absente jusqu'ici
            'matricule_s'     => auth()->id(),
        ]);
        return $this->ok('Personnel enregistré', ['matricule' => $request->matricule_pers], 201);
    }

    public function show($id)
    {
        $p = DB::table('personnel')->where('matricule_pers',$id)->first();
        if (!$p) return $this->err('Non trouvé', 404);
        return response()->json($p);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'nom_pers'    => 'required|string|max:255',
            'prenom_pers' => 'required|string|max:255',
            'id_fonction' => 'required|integer|exists:fonction,id_fonction',
        ]);
        DB::table('personnel')->where('matricule_pers',$id)->update([
            'nom_pers'       => $request->nom_pers,
            'prenom_pers'    => $request->prenom_pers,
            'ddn_pers'       => $request->ddn_pers       ?? null,
            'ldn_pers'       => $request->ldn_pers       ?? '',
            'cin_pers'       => $request->cin_pers       ?? '',
            'dcin_pers'      => $request->dcin_pers      ?? null,
            'lcin_pers'      => $request->lcin_pers      ?? '',
            'tel_pers'       => $request->tel_pers       ?? '',
            'email_pers'     => $request->email_pers     ?? '',
            'dembauche_pers' => $request->dembauche_pers ?? null,
            'salaire_pers'   => $request->salaire_pers   ?? 0,
            'diplome_pers'   => $request->diplome_pers   ?? '',
            'adresse_pers'   => $request->adresse_pers   ?? '',
            'id_fonction'    => $request->id_fonction,
        ]);
        return $this->ok('Personnel modifié');
    }

    public function destroy($id)
    {
        DB::table('personnel')->where('matricule_pers',$id)->delete();
        return $this->ok('Personnel supprimé');
    }

    public function uploadPhoto(Request $request, $id)
    {
        $request->validate(['photo'=>'required|image|max:2048']);
        $path = $request->file('photo')->store('personnels','public');
        DB::table('personnel')->where('matricule_pers',$id)->update(['photo_pers'=>$path]);
        return response()->json(['photo_pers'=>$path, 'photo_url'=>url('storage/'.$path)]);
    }

    /* ── FONCTIONS ── */
    public function indexFonction(Request $request)
    {
        $query = DB::table('fonction as f')
            ->leftJoin('users as u', 'f.matricule_s', '=', 'u.id')
            ->select(
                'f.id_fonction','f.nom_fonction','f.description_fonction',
                DB::raw("IFNULL(u.name,'') as editeur")
            );
        return $this->paginate($query, $request,
            ['f.nom_fonction','f.description_fonction'],
            'f.id_fonction'
        );
    }

    public function storeFonction(Request $request)
    {
        $request->validate(['nom_fonction'=>'required|string|max:255']);
        $id = DB::table('fonction')->insertGetId([
            'nom_fonction'         => $request->nom_fonction,
            'description_fonction' => $request->description_fonction ?? '',
            // FIX : cohérence avec les autres modules, même si pas encore affiché en UI
            'matricule_s'          => auth()->id(),
        ]);
        return $this->ok('Fonction créée', ['id_fonction'=>$id], 201);
    }

    public function updateFonction(Request $request, $id)
    {
        $request->validate(['nom_fonction'=>'required|string|max:255']);
        DB::table('fonction')->where('id_fonction',$id)->update([
            'nom_fonction'         => $request->nom_fonction,
            'description_fonction' => $request->description_fonction ?? '',
        ]);
        return $this->ok('Fonction modifiée');
    }

    public function destroyFonction($id)
    {
        $count = DB::table('personnel')->where('id_fonction',$id)->count();
        if ($count > 0) return $this->err("Impossible : $count personnel(s) utilisent cette fonction.", 422);
        DB::table('fonction')->where('id_fonction',$id)->delete();
        return $this->ok('Fonction supprimée');
    }
}