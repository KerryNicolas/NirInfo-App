<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InscriptionController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('inscription as i')
            ->join('etudiant as e',      'i.matricule_etudiant','=','e.matricule_etudiant')
            ->leftJoin('salarie as sal',  'i.matricule_s',       '=','sal.matricule_s')
            ->leftJoin('compte as c',     DB::raw('CAST(i.type_paiement AS UNSIGNED)'), '=', 'c.id_compte')
            ->select(
                'i.id_paiement',
                'i.matricule_etudiant as matricule',
                'e.nom_etudiant       as nom',
                'e.prenom_etudiant    as prenom',
                'i.code_session',
                'i.date_paiement',
                'i.montant_paye',
                'i.reste_a_payer      as reste',
                'i.ref_facture',
                DB::raw("IFNULL(c.libelle, i.type_paiement) as compte"),
                'i.lieu_paiement',
                DB::raw("CONCAT(IFNULL(sal.nom_s,''),' ',IFNULL(sal.prenom_s,'')) as editeur")
            );

        return $this->paginate($query, $request,
            ['i.matricule_etudiant','e.nom_etudiant','e.prenom_etudiant','i.code_session'],
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
            'matricule'     => 'required|string|exists:etudiant,matricule_etudiant',
            'code_session'  => 'required|string|exists:session,code_session',
            'montant_paye'  => 'required|numeric|min:0',
            'id_compte'     => 'required|integer|exists:compte,id_compte',
            'lieu_paiement' => 'required|string',
        ]);

        $session  = DB::table('session')->where('code_session', $request->code_session)->first();
        $frais    = $session ? floatval($session->frais_module) : 0;
        $dejaPaye = DB::table('inscription')
            ->where('matricule_etudiant', $request->matricule)
            ->where('code_session',       $request->code_session)
            ->sum('montant_paye');
        $reste = max(0, $frais - ($dejaPaye + floatval($request->montant_paye)));

        DB::beginTransaction();
        try {
            // 1. Transaction financière (entrée d'argent)
            $idTransaction = DB::table('transaction')->insertGetId([
                'transaction_type' => 'E',
                'amount'           => $request->montant_paye,
                'reson'            => 'inscription',
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
            // `facture`. On ne la genere JAMAIS manuellement (ni time(), ni chaine) —
            // on laisse MySQL l'attribuer, puis on recupere l'ID genere avec insertGetId(). ──
            $numero = $this->generateNumero();

            $refFacture = DB::table('facture')->insertGetId([
                'numero_facture' => $numero,
                'matricule_s'    => auth()->user()->matricule ?? null,
            ], 'ref_facture');

            // 4. Inscription — utilise le ref_facture reellement genere par MySQL
            DB::table('inscription')->insert([
                'matricule_etudiant' => $request->matricule,
                'code_session'       => $request->code_session,
                'date_paiement'      => $request->date_paiement ?? now(),
                'montant_paye'       => $request->montant_paye,
                'type_paiement'      => $request->id_compte,
                'lieu_paiement'      => $request->lieu_paiement,
                'reste_a_payer'      => $reste,
                'ref_facture'        => $refFacture,
                'id_transaction'     => $idTransaction,
                // ── FIX : capture de l'éditeur, absente jusqu'ici sur cette table ──
                'matricule_s'        => auth()->user()->matricule ?? null,
            ]);

            DB::commit();

            return $this->ok('Inscription enregistrée, facture générée automatiquement', [
                'ref_facture' => $refFacture,
                'numero'      => 'FAC-' . $numero,
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la création', 'error' => $e->getMessage()], 500);
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
        return $this->ok('Inscription mise à jour');
    }

    public function destroy($id)
    {
        DB::table('inscription')->where('id_paiement', $id)->delete();
        return $this->ok('Inscription supprimée avec succès');
    }

    // ── Liste des comptes (pour le select) ──
    public function comptes()
    {
        return response()->json(DB::table('compte')->select('id_compte', 'libelle')->get());
    }
}