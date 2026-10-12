<?php

namespace App\Http\Controllers;

use App\Models\Etudiant;
use App\Services\MatriculeEtudiantService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
                DB::raw("CONCAT(IFNULL(s.nom_s,''),' ',IFNULL(s.prenom_s,'')) as editeur"),
                DB::raw("CAST(SUBSTRING(etudiant.matricule_etudiant, 4) AS UNSIGNED) as tri_matricule")
            );

        return $this->paginate($query, $request, [
            'etudiant.nom_etudiant',
            'etudiant.prenom_etudiant',
            'etudiant.matricule_etudiant',
            'etudiant.cin_etudiant',
        ], 'tri_matricule');
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

        // Série partagée avec les certificats saisis à la main : le service
        // tient compte des deux pour ne jamais donner deux fois le même numéro.
        $matricule = app(MatriculeEtudiantService::class)->attribuer(fn (string $matricule) => DB::table('etudiant')->insert([
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
            // ── FIX : capture de l'éditeur, absente jusqu'ici (comme tous les autres modules) ──
            'matricule_s'        => auth()->user()->matricule ?? null,
        ]));

        return $this->ok('Étudiant créé avec succès', ['matricule' => $matricule], 201);
    }

    /* ══════════════════════════════════════
     | SHOW — fiche d'un seul étudiant par matricule
     ══════════════════════════════════════ */
    // FIX : méthode manquante — CertificationTab.tsx (et probablement
    // d'autres écrans) appellent GET /etudiants/{matricule} pour vérifier
    // qu'un étudiant existe avant de créer/modifier un certificat. Comme
    // cette méthode n'existait pas du tout, l'appel échouait TOUJOURS
    // (route inexistante ou erreur serveur selon la config des routes), et
    // le frontend affichait "Étudiant non trouvé" même pour un étudiant
    // qui existe très bien — un faux négatif systématique, indépendant des
    // données. Champs renvoyés bruts (nom_etudiant, prenom_etudiant...) car
    // c'est ce que le frontend lit directement (pas les alias nom/prenom
    // utilisés dans index()).
    public function show($id)
    {
        $etudiant = DB::table('etudiant')->where('matricule_etudiant', $id)->first();
        if (!$etudiant) {
            return response()->json(['message' => 'Étudiant non trouvé'], 404);
        }
        return response()->json($etudiant);
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
    // FIX : aucune contrainte de clé étrangère n'existe en base entre
    // inscription.matricule_etudiant et etudiant.matricule_etudiant (vérifié
    // via information_schema — KEY_COLUMN_USAGE et REFERENTIAL_CONSTRAINTS
    // renvoient vide). Sans ce garde-fou, supprimer un étudiant laissait ses
    // inscriptions/recouvrements orphelins dans la table `inscription` :
    // elles disparaissaient silencieusement de tous les écrans (le JOIN avec
    // `etudiant` dans InscriptionController::index les exclut), alors que
    // l'argent déjà encaissé restait compté indéfiniment dans le solde du
    // compte — un trou invisible dans le Budget. On bloque désormais la
    // suppression tant que l'étudiant a au moins une ligne dans `inscription`
    // (table partagée par Inscription ET Recouvrement).
    public function destroy($id)
    {
        $exists = DB::table('etudiant')->where('matricule_etudiant', $id)->exists();
        if (!$exists) return $this->err('Étudiant non trouvé', 404);

        $nbInscriptions = DB::table('inscription')->where('matricule_etudiant', $id)->count();
        if ($nbInscriptions > 0) {
            return $this->err(
                "Impossible de supprimer cet étudiant : il a $nbInscriptions inscription(s)/paiement(s) enregistré(s). Supprimez d'abord ses inscriptions et recouvrements, ou contactez un administrateur.",
                422
            );
        }

        DB::table('etudiant')->where('matricule_etudiant', $id)->delete();
        return $this->ok('Étudiant supprimé avec succès');
    }

    /* ══════════════════════════════════════
     | UPLOAD PHOTO
     ══════════════════════════════════════ */
    public function uploadPhoto(Request $request, $id)
    {
        $request->validate(['photo' => 'required|image|max:2048']);

        $filename = $id . '_' . time() . '.' . $request->photo->extension();
        $request->photo->storeAs('public/photos', $filename);

        DB::table('etudiant')
            ->where('matricule_etudiant', $id)
            ->update(['photo_etudiant' => $filename]);

        return $this->ok('Photo mise à jour', [
            'photo_url' => url('storage/photos/' . $filename)
        ]);
    }
}