<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransferController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('transfer as t')
            ->join('compte as c1', 't.starting_account',   '=', 'c1.id_compte')
            ->join('compte as c2', 't.destination_account', '=', 'c2.id_compte')
            ->select(
                't.id_transfer',
                't.starting_account',
                't.destination_account',
                't.amount',
                'c1.account_number as starting_number',
                'c1.libelle        as starting_libelle',
                'c2.account_number as destination_number',
                'c2.libelle        as destination_libelle'
            );

        return $this->paginate($query, $request,
            ['c1.libelle', 'c2.libelle', 'c1.account_number', 'c2.account_number'],
            't.id_transfer'
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'starting_account'    => 'required|integer|exists:compte,id_compte|different:destination_account',
            'destination_account' => 'required|integer|exists:compte,id_compte',
            'amount'              => 'required|numeric|min:1',
        ]);

        $soldeOrigine = (float) DB::table('compte')->where('id_compte', $request->starting_account)->value('montant');
        if ($request->amount > $soldeOrigine) {
            return $this->err('Solde insuffisant sur le compte de départ', 422);
        }

        DB::beginTransaction();
        try {
            DB::table('transfer')->insert([
                'starting_account'    => $request->starting_account,
                'destination_account' => $request->destination_account,
                'amount'              => $request->amount,
            ]);

            DB::table('compte')->where('id_compte', $request->starting_account)
                ->decrement('montant', $request->amount);
            DB::table('compte')->where('id_compte', $request->destination_account)
                ->increment('montant', $request->amount);

            DB::commit();
            return $this->ok('Virement effectué avec succès', [], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors du virement', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        DB::table('transfer')->where('id_transfer', $id)->delete();
        return $this->ok('Supprimé avec succès');
    }
}