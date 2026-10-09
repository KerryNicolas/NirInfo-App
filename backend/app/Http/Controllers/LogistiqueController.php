<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LogistiqueController extends BaseApiController
{
    /* ═══════════════════════════════════════════
     *  ACHAT
     * ═══════════════════════════════════════════ */
    public function indexAchat(Request $request)
    {
        $query = DB::table('achat as a')
            ->leftJoin('users as u', 'a.matricule_s', '=', 'u.id')
            ->select(
                'a.id_achat',
                'a.nom_materiel',
                'a.prix_unitaire',
                'a.quantite',
                'a.montant',
                'a.date_achat',
                'a.photo_achat',
                DB::raw("IFNULL(u.name,'') as editeur")
            );

        if ($request->filled('date_debut')) $query->whereDate('a.date_achat', '>=', $request->date_debut);
        if ($request->filled('date_fin'))   $query->whereDate('a.date_achat', '<=', $request->date_fin);

        return $this->paginate($query, $request, ['a.nom_materiel'], 'a.id_achat');
    }

    public function storeAchat(Request $request)
    {
        $request->validate([
            'nom_materiel'  => 'required|string|max:255',
            'prix_unitaire' => 'required|numeric|min:0',
            'quantite'      => 'required|integer|min:1',
            'date_achat'    => 'required|date',
        ]);

        $id = DB::table('achat')->insertGetId([
            'nom_materiel'   => $request->nom_materiel,
            'prix_unitaire'  => $request->prix_unitaire,
            'quantite'       => $request->quantite,
            'montant'        => $request->prix_unitaire * $request->quantite,
            'date_achat'     => $request->date_achat,
            'photo_achat'    => $request->photo_achat    ?? '',
            'id_transaction' => $request->id_transaction ?? 0,
            // FIX : capture de l'éditeur, absente jusqu'ici
            'matricule_s'    => auth()->id(),
        ]);

        return $this->ok('Achat enregistré', ['id' => $id], 201);
    }

    public function updateAchat(Request $request, $id)
    {
        $request->validate([
            'nom_materiel'  => 'required|string|max:255',
            'prix_unitaire' => 'required|numeric|min:0',
            'quantite'      => 'required|integer|min:1',
            'date_achat'    => 'required|date',
        ]);

        DB::table('achat')->where('id_achat', $id)->update([
            'nom_materiel'  => $request->nom_materiel,
            'prix_unitaire' => $request->prix_unitaire,
            'quantite'      => $request->quantite,
            'montant'       => $request->prix_unitaire * $request->quantite,
            'date_achat'    => $request->date_achat,
            'photo_achat'   => $request->photo_achat ?? '',
        ]);

        return $this->ok('Achat modifié');
    }

    public function destroyAchat($id)
    {
        DB::table('achat')->where('id_achat', $id)->delete();
        return $this->ok('Achat supprimé');
    }

    public function uploadPhotoAchat(Request $request, $id)
    {
        $request->validate(['photo' => 'required|image|max:2048']);
        $path = $request->file('photo')->store('achats', 'public');
        DB::table('achat')->where('id_achat', $id)->update(['photo_achat' => $path]);
        return response()->json(['path' => $path]);
    }

    /* ═══════════════════════════════════════════
     *  CHARGE
     * ═══════════════════════════════════════════ */
    public function indexCharge(Request $request)
    {
        $query = DB::table('charge as c')
            ->leftJoin('users as u', 'c.matricule_s', '=', 'u.id')
            ->select(
                'c.id_charge',
                'c.designation',
                'c.montant',
                'c.mois',
                'c.annee',
                'c.date',
                'c.photo_charge',
                DB::raw("IFNULL(u.name,'') as editeur")
            );

        if ($request->filled('mois'))       $query->where('c.mois',  $request->mois);
        if ($request->filled('annee'))      $query->where('c.annee', $request->annee);
        if ($request->filled('date_debut')) $query->whereDate('c.date', '>=', $request->date_debut);
        if ($request->filled('date_fin'))   $query->whereDate('c.date', '<=', $request->date_fin);

        return $this->paginate($query, $request, ['c.designation'], 'c.id_charge');
    }

    public function storeCharge(Request $request)
    {
        $request->validate([
            'designation' => 'required|string|max:255',
            'montant'     => 'required|numeric|min:0',
            'mois'        => 'required|integer|between:1,12',
            'annee'       => 'required|integer|min:2000',
            'date'        => 'required|date',
        ]);

        $id = DB::table('charge')->insertGetId([
            'designation'    => $request->designation,
            'montant'        => $request->montant,
            'mois'           => $request->mois,
            'annee'          => $request->annee,
            'date'           => $request->date,
            'photo_charge'   => $request->photo_charge   ?? '',
            'id_transaction' => $request->id_transaction ?? 0,
            // FIX : capture de l'éditeur, absente jusqu'ici
            'matricule_s'    => auth()->id(),
        ]);

        return $this->ok('Charge enregistrée', ['id' => $id], 201);
    }

    public function updateCharge(Request $request, $id)
    {
        $request->validate([
            'designation' => 'required|string|max:255',
            'montant'     => 'required|numeric|min:0',
            'mois'        => 'required|integer|between:1,12',
            'annee'       => 'required|integer|min:2000',
            'date'        => 'required|date',
        ]);

        DB::table('charge')->where('id_charge', $id)->update([
            'designation'  => $request->designation,
            'montant'      => $request->montant,
            'mois'         => $request->mois,
            'annee'        => $request->annee,
            'date'         => $request->date,
            'photo_charge' => $request->photo_charge ?? '',
        ]);

        return $this->ok('Charge modifiée');
    }

    public function destroyCharge($id)
    {
        DB::table('charge')->where('id_charge', $id)->delete();
        return $this->ok('Charge supprimée');
    }

    /* ═══════════════════════════════════════════
     *  RETOUR (retour de matériel / fournisseur)
     * ═══════════════════════════════════════════ */
    public function indexRetour(Request $request)
    {
        $query = DB::table('retour as r')
            ->leftJoin('achat as a', 'r.id_achat', '=', 'a.id_achat')
            ->select(
                'r.id_retour',
                'r.id_achat',
                'r.motif',
                'r.quantite_retour',
                'r.montant_retour',
                'r.date_retour',
                'r.statut',
                DB::raw("IFNULL(a.nom_materiel,'') as nom_materiel")
            );

        if ($request->filled('statut')) $query->where('r.statut', $request->statut);
        if ($request->filled('date_debut')) $query->whereDate('r.date_retour', '>=', $request->date_debut);
        if ($request->filled('date_fin'))   $query->whereDate('r.date_retour', '<=', $request->date_fin);

        return $this->paginate($query, $request, ['r.motif', 'a.nom_materiel'], 'r.id_retour');
    }

    public function storeRetour(Request $request)
    {
        $request->validate([
            'id_achat'        => 'required|integer',
            'motif'           => 'required|string|max:500',
            'quantite_retour' => 'required|integer|min:1',
            'date_retour'     => 'required|date',
            'statut'          => 'required|in:en_attente,accepte,refuse',
        ]);

        $achat = DB::table('achat')->where('id_achat', $request->id_achat)->first();
        $montant = $achat ? $achat->prix_unitaire * $request->quantite_retour : 0;

        $id = DB::table('retour')->insertGetId([
            'id_achat'        => $request->id_achat,
            'motif'           => $request->motif,
            'quantite_retour' => $request->quantite_retour,
            'montant_retour'  => $montant,
            'date_retour'     => $request->date_retour,
            'statut'          => $request->statut,
        ]);

        return $this->ok('Retour enregistré', ['id' => $id], 201);
    }

    public function updateRetour(Request $request, $id)
    {
        $request->validate([
            'motif'           => 'required|string|max:500',
            'quantite_retour' => 'required|integer|min:1',
            'date_retour'     => 'required|date',
            'statut'          => 'required|in:en_attente,accepte,refuse',
        ]);

        $retour = DB::table('retour')->where('id_retour', $id)->first();
        $achat  = $retour ? DB::table('achat')->where('id_achat', $retour->id_achat)->first() : null;
        $montant = $achat ? $achat->prix_unitaire * $request->quantite_retour : 0;

        DB::table('retour')->where('id_retour', $id)->update([
            'motif'           => $request->motif,
            'quantite_retour' => $request->quantite_retour,
            'montant_retour'  => $montant,
            'date_retour'     => $request->date_retour,
            'statut'          => $request->statut,
        ]);

        return $this->ok('Retour modifié');
    }

    public function destroyRetour($id)
    {
        DB::table('retour')->where('id_retour', $id)->delete();
        return $this->ok('Retour supprimé');
    }

    /* ═══════════════════════════════════════════
     *  AUTRE (dépenses diverses)
     * ═══════════════════════════════════════════ */
    public function indexAutre(Request $request)
    {
        $query = DB::table('autre_depense')->orderBy('id', 'desc');
        return $this->paginate($query, $request, ['designation'], 'id');
    }

    public function storeAutre(Request $request)
    {
        $request->validate([
            'designation' => 'required|string|max:255',
            'montant'     => 'required|numeric|min:0',
        ]);
        $id = DB::table('autre_depense')->insertGetId([
            'designation' => $request->designation,
            'montant'     => $request->montant,
            'date'        => $request->date ?? now()->toDateString(),
        ]);
        return $this->ok('Dépense enregistrée', ['id' => $id], 201);
    }

    public function destroyAutre($id)
    {
        DB::table('autre_depense')->where('id', $id)->delete();
        return $this->ok('Dépense supprimée');
    }
}