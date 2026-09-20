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

    // FIX (point 9) : modification d'un virement — l'ancien mouvement est
    // d'abord intégralement annulé (on recrédite le compte de départ et on
    // redébite le compte de destination avec les ANCIENNES valeurs), puis le
    // nouveau mouvement est appliqué avec les valeurs à jour. Même schéma que
    // InscriptionController::update / GererController::destroy : jamais de
    // double comptabilisation, tout se fait dans une seule transaction.
    public function update(Request $request, $id)
    {
        $original = DB::table('transfer')->where('id_transfer', $id)->first();
        if (!$original) {
            return $this->err('Virement non trouvé', 404);
        }

        $request->validate([
            'starting_account'    => 'required|integer|exists:compte,id_compte|different:destination_account',
            'destination_account' => 'required|integer|exists:compte,id_compte',
            'amount'              => 'required|numeric|min:1',
        ]);

        DB::beginTransaction();
        try {
            // 1. Annule complètement l'ancien mouvement (peu importe si le
            //    compte de départ/destination a aussi changé).
            DB::table('compte')->where('id_compte', $original->starting_account)
                ->increment('montant', $original->amount);
            DB::table('compte')->where('id_compte', $original->destination_account)
                ->decrement('montant', $original->amount);

            // 2. Vérifie le solde du (nouveau) compte de départ après
            //    annulation de l'ancien mouvement.
            $soldeOrigine = (float) DB::table('compte')->where('id_compte', $request->starting_account)->value('montant');
            if ($request->amount > $soldeOrigine) {
                DB::rollBack();
                return $this->err('Solde insuffisant sur le compte de départ', 422);
            }

            // 3. Applique le nouveau mouvement avec les valeurs mises à jour.
            DB::table('compte')->where('id_compte', $request->starting_account)
                ->decrement('montant', $request->amount);
            DB::table('compte')->where('id_compte', $request->destination_account)
                ->increment('montant', $request->amount);

            DB::table('transfer')->where('id_transfer', $id)->update([
                'starting_account'    => $request->starting_account,
                'destination_account' => $request->destination_account,
                'amount'              => $request->amount,
            ]);

            DB::commit();
            return $this->ok('Virement mis à jour avec succès — les soldes ont été recalculés');

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la modification', 'error' => $e->getMessage()], 500);
        }
    }

    // FIX : la suppression ne réajustait jamais les soldes des comptes
    // (même bug que GererController::destroy avant sa correction) — le
    // montant restait "fantôme" dans les deux comptes après suppression.
    // On annule maintenant le mouvement avant de supprimer la ligne.
    public function destroy($id)
    {
        $original = DB::table('transfer')->where('id_transfer', $id)->first();
        if (!$original) {
            return $this->err('Virement non trouvé', 404);
        }

        DB::beginTransaction();
        try {
            DB::table('compte')->where('id_compte', $original->starting_account)
                ->increment('montant', $original->amount);
            DB::table('compte')->where('id_compte', $original->destination_account)
                ->decrement('montant', $original->amount);

            DB::table('transfer')->where('id_transfer', $id)->delete();

            DB::commit();
            return $this->ok('Supprimé avec succès — les soldes des comptes ont été réajustés');
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la suppression', 'error' => $e->getMessage()], 500);
        }
    }
}