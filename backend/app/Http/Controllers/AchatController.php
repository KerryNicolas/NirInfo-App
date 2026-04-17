<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AchatController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('achat as a')
            ->leftJoin('salarie as s', 'a.matricule_s', '=', 's.matricule_s')
            ->select(
                'a.id_achat',
                'a.nom_materiel',
                'a.prix_unitaire',
                'a.quantite',
                'a.montant',
                'a.date_achat',
                'a.photo_achat',
                DB::raw("IFNULL(CONCAT(s.nom_s,' ',s.prenom_s),'') as editeur")
            );

        if ($request->filled('date_debut')) $query->whereDate('a.date_achat', '>=', $request->date_debut);
        if ($request->filled('date_fin'))   $query->whereDate('a.date_achat', '<=', $request->date_fin);

        // LIFO : id_achat DESC
        return $this->paginate($query, $request,
            ['a.nom_materiel'],
            'a.id_achat'
        );
    }

    public function store(Request $request)
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
            'photo_achat'    => $request->photo_achat   ?? '',
            'id_transaction' => $request->id_transaction ?? 0,
            'matricule_s'    => null,
        ]);

        return $this->ok('Achat enregistré', ['id' => $id], 201);
    }

    public function show($id)
    {
        $a = DB::table('achat')->where('id_achat', $id)->first();
        if (!$a) return $this->err('Non trouvé', 404);
        return response()->json($a);
    }

    public function update(Request $request, $id)
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

    public function destroy($id)
    {
        DB::table('achat')->where('id_achat', $id)->delete();
        return $this->ok('Achat supprimé');
    }

    public function uploadPhoto(Request $request)
    {
        $request->validate(['photo' => 'required|image|max:2048']);
        $path = $request->file('photo')->store('achats', 'public');
        return response()->json(['path' => $path]);
    }
}