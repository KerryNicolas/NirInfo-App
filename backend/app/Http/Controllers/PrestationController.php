<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PrestationController extends BaseApiController
{
    // ─── Liste — GET /prestations (paiements initiaux) ──
    public function index(Request $request)
    {
        $query = DB::table('prestation as p')
            ->join('client as c',    'p.benefit_client',  '=', 'c.id_client')
            ->join('services as s',  'p.benefit_service', '=', 's.id_services')
            ->join('compte as co',   'p.account',         '=', 'co.id_compte')
            ->where('p.type', 'paiement')
            ->select(
                'p.id_prestation',
                'p.benefit_date',
                'p.benefit_client',
                'p.benefit_service',
                'c.client_name',
                's.service_name',
                'p.benefit_costs',
                'p.payroll_amount',
                'co.account_number',
                'p.account'
            );

        return $this->paginate($query, $request,
            ['c.client_name', 's.service_name'],
            'p.id_prestation'
        );
    }

    // ─── Liste — GET /recouvrements-prestation ──
    public function indexRecouvrement(Request $request)
    {
        $query = DB::table('prestation as p')
            ->join('client as c',    'p.benefit_client',  '=', 'c.id_client')
            ->join('services as s',  'p.benefit_service', '=', 's.id_services')
            ->join('compte as co',   'p.account',         '=', 'co.id_compte')
            ->where('p.type', 'recouvrement')
            ->select(
                'p.id_prestation',
                'p.benefit_date',
                'p.benefit_client',
                'p.benefit_service',
                'c.client_name',
                's.service_name',
                'p.benefit_costs',
                'p.payroll_amount',
                'co.account_number',
                'p.account'
            );

        return $this->paginate($query, $request,
            ['c.client_name', 's.service_name'],
            'p.id_prestation'
        );
    }

    // ─── Reste à payer pour un client+service donné (avant nouvelle prestation/recouvrement) ──
    public function resteAPayer(Request $request)
    {
        $request->validate([
            'benefit_client'  => 'required|integer',
            'benefit_service' => 'required|integer',
        ]);

        $costs = (float) DB::table('prestation')
            ->where('benefit_client', $request->benefit_client)
            ->where('benefit_service', $request->benefit_service)
            ->where('type', 'paiement')
            ->value('benefit_costs') ?? 0;

        $dejaPaye = (float) DB::table('prestation')
            ->where('benefit_client', $request->benefit_client)
            ->where('benefit_service', $request->benefit_service)
            ->sum('payroll_amount');

        return response()->json([
            'benefit_costs'  => $costs,
            'deja_paye'      => $dejaPaye,
            'reste_a_payer'  => max(0, $costs - $dejaPaye),
        ]);
    }

    // ─── Création — POST /prestations (type=paiement) ou /recouvrements-prestation (type=recouvrement) ──
    public function store(Request $request, string $type)
    {
        $request->validate([
            'benefit_date'    => 'required|date',
            'benefit_client'  => 'required|integer|exists:client,id_client',
            'benefit_service' => 'required|integer|exists:services,id_services',
            'payroll_amount'  => 'required|numeric|min:1',
            'account'         => 'required|integer|exists:compte,id_compte',
        ]);

        if ($type === 'paiement') {
            $request->validate(['benefit_costs' => 'required|numeric|min:0']);
        }

        DB::beginTransaction();
        try {
            // 1. Transaction financière (entrée d'argent)
            $idTransaction = DB::table('transaction')->insertGetId([
                'transaction_type' => 'E',
                'amount'           => $request->payroll_amount,
                'reson'            => $type === 'paiement' ? 'prestation' : 'recouvrement_prestation',
                'account'          => $request->account,
                'matricule_s'      => auth()->id(),
            ]);

            // 2. Mise à jour du solde du compte
            DB::table('compte')->where('id_compte', $request->account)
                ->increment('montant', $request->payroll_amount);

            // 3. benefit_costs : fourni si "paiement", sinon repris de la prestation d'origine si "recouvrement"
            $benefitCosts = $request->benefit_costs;
            if ($type === 'recouvrement') {
                $benefitCosts = DB::table('prestation')
                    ->where('benefit_client', $request->benefit_client)
                    ->where('benefit_service', $request->benefit_service)
                    ->where('type', 'paiement')
                    ->value('benefit_costs') ?? 0;
            }

            // 4. Ligne prestation (paiement initial ou recouvrement)
            DB::table('prestation')->insert([
                'benefit_date'    => $request->benefit_date,
                'benefit_client'  => $request->benefit_client,
                'benefit_service' => $request->benefit_service,
                'benefit_costs'   => $benefitCosts,
                'payroll_amount'  => $request->payroll_amount,
                'account'         => $request->account,
                'type'            => $type,
                'id_transaction'  => $idTransaction,
            ]);

            DB::commit();
            return $this->ok('Enregistré avec succès', [], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de l\'enregistrement', 'error' => $e->getMessage()], 500);
        }
    }

    public function update(Request $request, $id)
    {
        DB::table('prestation')->where('id_prestation', $id)->update([
            'benefit_date'   => $request->benefit_date,
            'benefit_costs'  => $request->benefit_costs,
            'payroll_amount' => $request->payroll_amount,
            'account'        => $request->account,
        ]);
        return $this->ok('Mis à jour avec succès');
    }

    public function destroy($id)
    {
        DB::table('prestation')->where('id_prestation', $id)->delete();
        return $this->ok('Supprimé avec succès');
    }
}