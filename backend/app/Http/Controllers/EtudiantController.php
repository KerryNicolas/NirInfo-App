<?php

namespace App\Http\Controllers;

use App\Models\Etudiant;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * EtudiantController — exemple de migration vers BaseApiController + Eloquent.
 * Tous vos autres controllers suivront exactement le même pattern.
 */
class EtudiantController extends BaseApiController
{
    /* ══════════════════════════════════════
     | INDEX — liste paginée LIFO
     ══════════════════════════════════════ */
    public function index(Request $request)
    {
        $query = Etudiant::query()
            ->leftJoin('salarie as s', 'etudiant.matricule_s', '=', 's.matricule_s')
            ->select(
                'etudiant.matricule_etudiant as matricule',
                'etudiant.nom_etudiant       as nom',
                'etudiant.prenom_etudiant    as prenom',
                'etudiant.sexe',
                'etudiant.dn_etudiant        as date_naissance',
                'etudiant.ln_etudiant        as lieu_naissance',
                'etudiant.cin_etudiant       as numero_cin',
                'etudiant.dcin_etudiant      as date_cin',
                'etudiant.lcin_etudiant      as lieu_cin',
                'etudiant.tel_etudiant       as telephone',
                'etudiant.mail_etudiant      as email',
                'etudiant.photo_etudiant     as photo',
                DB::raw("CONCAT(IFNULL(s.nom_s,''),' ',IFNULL(s.prenom_s,'')) as editeur")
            );

        return $this->paginate($query, $request, [
            'etudiant.nom_etudiant',
            'etudiant.prenom_etudiant',
            'etudiant.matricule_etudiant',
            'etudiant.cin_etudiant',
        ], 'etudiant.matricule_etudiant');
    }

    /* ══════════════════════════════════════
     | STORE
     ══════════════════════════════════════ */
    public function store(Request $request)
    {
        $request->validate([
            'nom'    => 'required|string|max:255',
            'prenom' => 'required|string|max:255',
            'sexe'   => 'required|in:HOMME,FEMME',
        ]);

        // Génération matricule NI-XXXX
        $last = DB::table('etudiant')->max(DB::raw("CAST(SUBSTRING(matricule_etudiant, 4) AS UNSIGNED)"));
        $matricule = 'NI-' . str_pad(($last ?? 0) + 1, 4, '0', STR_PAD_LEFT);

        DB::table('etudiant')->insert([
            'matricule_etudiant' => $matricule,
            'nom_etudiant'       => strtoupper($request->nom),
            'prenom_etudiant'    => $request->prenom,
            'sexe'               => $request->sexe,
            'dn_etudiant'        => $request->date_naissance  ?? null,
            'ln_etudiant'        => $request->lieu_naissance  ?? '',
            'cin_etudiant'       => $request->numero_cin      ?? '',
            'dcin_etudiant'      => $request->date_cin        ?? null,
            'lcin_etudiant'      => $request->lieu_cin        ?? '',
            'tel_etudiant'       => $request->telephone       ?? '',
            'mail_etudiant'      => $request->email           ?? '',
            'photo_etudiant'     => '',
        ]);

        return $this->ok('Étudiant créé avec succès', ['matricule' => $matricule], 201);
    }

    /* ══════════════════════════════════════
     | UPDATE
     ══════════════════════════════════════ */
    public function update(Request $request, $id)
    {
        $exists = DB::table('etudiant')->where('matricule_etudiant', $id)->exists();
        if (!$exists) return $this->err('Étudiant non trouvé', 404);

        DB::table('etudiant')->where('matricule_etudiant', $id)->update([
            'nom_etudiant'    => strtoupper($request->nom    ?? ''),
            'prenom_etudiant' => $request->prenom            ?? '',
            'sexe'            => $request->sexe              ?? 'HOMME',
            'dn_etudiant'     => $request->date_naissance    ?? null,
            'ln_etudiant'     => $request->lieu_naissance    ?? '',
            'cin_etudiant'    => $request->numero_cin        ?? '',
            'dcin_etudiant'   => $request->date_cin          ?? null,
            'lcin_etudiant'   => $request->lieu_cin          ?? '',
            'tel_etudiant'    => $request->telephone         ?? '',
            'mail_etudiant'   => $request->email             ?? '',
        ]);

        return $this->ok('Étudiant mis à jour avec succès');
    }

    /* ══════════════════════════════════════
     | DESTROY
     ══════════════════════════════════════ */
    public function destroy($id)
    {
        DB::table('etudiant')->where('matricule_etudiant', $id)->delete();
        return $this->ok('Étudiant supprimé avec succès');
    }

    /* ══════════════════════════════════════
     | UPLOAD PHOTO
     ══════════════════════════════════════ */
    public function uploadPhoto(Request $request, $id)
    {
        $request->validate(['photo' => 'required|image|max:2048']);

        $filename = 'etudiant_' . time() . '.' . $request->photo->extension();
        $request->photo->storeAs('public/photos', $filename);

        DB::table('etudiant')
            ->where('matricule_etudiant', $id)
            ->update(['photo_etudiant' => $filename]);

        return $this->ok('Photo mise à jour', [
            'photo_url' => url('storage/photos/' . $filename)
        ]);
    }
}