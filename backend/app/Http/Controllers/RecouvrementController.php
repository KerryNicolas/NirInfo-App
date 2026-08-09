<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RecouvrementController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('inscription as i')
            ->join('etudiant as e',      'i.matricule_etudiant','=','e.matricule_etudiant')
            ->leftJoin('salarie as sal',  'i.matricule_s',       '=','sal.matricule_s')
            ->leftJoin('compte as c',     DB::raw('CAST(i.type_paiement AS UNSIGNED)'), '=', 'c.id_compte')
            ->select(
                'i.id_paiement        as id_recouvrement',
                'i.matricule_etudiant as matricule',
                'e.nom_etudiant       as nom',
                'e.prenom_etudiant    as prenom',
                'i.code_session',
                'i.date_paiement',
                'i.montant_paye',
                'i.reste_a_payer      as reste',
                DB::raw("IFNULL(c.libelle, i.type_paiement) as compte"),
                'i.lieu_paiement',
                'i.ref_facture',
                DB::raw("CONCAT(IFNULL(sal.nom_s,''),' ',IFNULL(sal.prenom_s,'')) as editeur")
            )
            ->where('i.reste_a_payer', '>', 0);

        return $this->paginate($query, $request,
            ['i.matricule_etudiant', 'e.nom_etudiant', 'i.code_session'],
            'i.id_paiement'
        );
    }

    // ─── Numéro lisible "2026-0003", basé sur ref_facture (seule clé existante) ──
    private function generateNumero(): string
    {
        $last = DB::table('facture')->orderByDesc('ref_facture')->first();

        if ($last && !empty($last->numero_facture) && str_contains($last->numero_facture, '-')) {
            [$year, $seq] = explode('-', $last->numero_facture);
            if ($year == date('Y')) {
                return $year . '-' . str_pad((int)$seq + 1, 4, '0', STR_PAD_LEFT);
            }
        }
        return date('Y') . '-0001';
    }

    public function store(Request $request)
    {
        $request->validate([
            'matricule'    => 'required|string',
            'code_session' => 'required|string',
            'montant_paye' => 'required|numeric|min:1',
            'id_compte'    => 'required|integer|exists:compte,id_compte',
        ]);

        $original = DB::table('inscription')
            ->where('matricule_etudiant', $request->matricule)
            ->where('code_session',       $request->code_session)
            ->orderBy('id_paiement', 'DESC')->first();

        if (!$original) return $this->err('Inscription non trouvée', 404);

        $nouveauReste = max(0, floatval($original->reste_a_payer) - floatval($request->montant_paye));

        DB::beginTransaction();
        try {
            // 1. Transaction financière (entrée d'argent)
            $idTransaction = DB::table('transaction')->insertGetId([
                'transaction_type' => 'E',
                'amount'           => $request->montant_paye,
                'reson'            => 'recouvrement',
                'account'          => $request->id_compte,
                'date_transaction' => now()->toDateString(),
            ]);

            // 2. Mise à jour du solde du compte
            DB::table('compte')->where('id_compte', $request->id_compte)
                ->increment('montant', $request->montant_paye);

            DB::table('gestion_compte')->insert([
                'id_compte'      => $request->id_compte,
                'type'           => 'E',
                'montant'        => $request->montant_paye,
                'date_gestion'   => now()->toDateString(),
                'id_transaction' => $idTransaction,
            ]);

            // ── FIX DEFINITIF : ref_facture est la cle primaire AUTO_INCREMENT de
            // `facture` — on laisse MySQL l'attribuer via insertGetId(), jamais de
            // generation manuelle (ni time(), ni chaine). ──
            $numero = $this->generateNumero();

            $refFacture = DB::table('facture')->insertGetId([
                'numero_facture' => $numero,
                'matricule_s'    => auth()->user()->matricule ?? null,
            ], 'ref_facture');

            // 3. Nouvelle ligne de paiement (recouvrement) — avec le vrai ref_facture genere
            DB::table('inscription')->insert([
                'matricule_etudiant' => $request->matricule,
                'code_session'       => $request->code_session,
                'date_paiement'      => $request->date_paiement ?? now(),
                'montant_paye'       => $request->montant_paye,
                'type_paiement'      => $request->id_compte,
                'lieu_paiement'      => $request->lieu_paiement ?? 'Ampandrana',
                'reste_a_payer'      => $nouveauReste,
                'ref_facture'        => $refFacture,
                'id_transaction'     => $idTransaction,
                // ── FIX : capture de l'éditeur, absente jusqu'ici sur cette table ──
                'matricule_s'        => auth()->user()->matricule ?? null,
            ]);

            // 4. Met à jour le reste sur l'inscription d'origine
            DB::table('inscription')->where('id_paiement', $original->id_paiement)
                ->update(['reste_a_payer' => $nouveauReste]);

            DB::commit();
            return $this->ok('Recouvrement enregistré avec succès', [
                'ref_facture' => $refFacture,
                'numero'      => 'FAC-' . $numero,
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de l\'enregistrement', 'error' => $e->getMessage()], 500);
        }
    }

    public function show($id)
    {
        return response()->json(DB::table('inscription')->where('id_paiement', $id)->first());
    }

    public function update(Request $request, $id)
    {
        DB::table('inscription')->where('id_paiement', $id)->update([
            'montant_paye'  => $request->montant_paye,
            'reste_a_payer' => $request->reste ?? 0,
            'lieu_paiement' => $request->lieu_paiement,
        ]);
        return $this->ok('Recouvrement mis à jour');
    }

    public function destroy($id)
    {
        DB::table('inscription')->where('id_paiement', $id)->delete();
        return $this->ok('Supprimé');
    }
}