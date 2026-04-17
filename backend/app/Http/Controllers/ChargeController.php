<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ChargeController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('charge as c')
            ->leftJoin('salarie as s', 'c.matricule_s', '=', 's.matricule_s')
            ->select(
                'c.id_charge',
                'c.designation',
                'c.montant',
                'c.mois',
                'c.annee',
                'c.date',
                'c.photo_charge',
                DB::raw("IFNULL(CONCAT(s.nom_s,' ',s.prenom_s),'') as editeur")
            );

        if ($request->filled('mois'))  $query->where('c.mois',  $request->mois);
        if ($request->filled('annee')) $query->where('c.annee', $request->annee);
        if ($request->filled('date_debut')) $query->whereDate('c.date', '>=', $request->date_debut);
        if ($request->filled('date_fin'))   $query->whereDate('c.date', '<=', $request->date_fin);

        // LIFO : id_charge DESC
        return $this->paginate($query, $request,
            ['c.designation'],
            'c.id_charge'
        );
    }

    public function store(Request $request)
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
            'matricule_s'    => null,
        ]);

        return $this->ok('Charge enregistrée', ['id' => $id], 201);
    }

    public function show($id)
    {
        $c = DB::table('charge')->where('id_charge', $id)->first();
        if (!$c) return $this->err('Non trouvé', 404);
        return response()->json($c);
    }

    public function update(Request $request, $id)
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

    public function destroy($id)
    {
        DB::table('charge')->where('id_charge', $id)->delete();
        return $this->ok('Charge supprimée');
    }

    public function uploadPhoto(Request $request)
    {
        $request->validate(['photo' => 'required|image|max:2048']);
        $path = $request->file('photo')->store('charges', 'public');
        return response()->json(['path' => $path]);
    }
}