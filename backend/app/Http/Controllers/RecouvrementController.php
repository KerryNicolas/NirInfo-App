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
                'i.type_paiement      as id_compte',
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

    // FIX : recalculerResteAPayer() et ajusterSoldeCompte() sont désormais
    // dans BaseApiController (partagées avec InscriptionController, même
    // table `inscription`) — plus de duplication.

    public function store(Request $request)
    {
        $request->validate([
            'matricule'    => 'required|string|exists:etudiant,matricule_etudiant',
            'code_session' => 'required|string|exists:session,code_session',
            'montant_paye' => 'required|numeric|min:1',
            'id_compte'    => 'required|integer|exists:compte,id_compte',
        ]);

        $original = DB::table('inscription')
            ->where('matricule_etudiant', $request->matricule)
            ->where('code_session',       $request->code_session)
            ->orderBy('id_paiement', 'DESC')->first();

        if (!$original) return $this->err('Inscription non trouvée', 404);

        DB::beginTransaction();
        try {
            $this->ajusterSoldeCompte((int)$request->id_compte, (float)$request->montant_paye, 'E', 'recouvrement');

            $numero = $this->generateNumero();
            $refFacture = DB::table('facture')->insertGetId([
                'numero_facture' => $numero,
                'matricule_s'    => auth()->user()->matricule ?? null,
            ], 'ref_facture');

            DB::table('inscription')->insert([
                'matricule_etudiant' => $request->matricule,
                'code_session'       => $request->code_session,
                'date_paiement'      => $request->date_paiement ?? now(),
                'montant_paye'       => $request->montant_paye,
                'type_paiement'      => $request->id_compte,
                'lieu_paiement'      => $request->lieu_paiement ?? 'Ampandrana',
                'reste_a_payer'      => 0,
                'ref_facture'        => $refFacture,
                'matricule_s'        => auth()->user()->matricule ?? null,
            ]);

            $this->recalculerResteAPayer($request->matricule, $request->code_session);

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
        $original = DB::table('inscription')->where('id_paiement', $id)->first();
        if (!$original) return $this->err('Recouvrement non trouvé', 404);

        $request->validate([
            'matricule'     => 'sometimes|required|string|exists:etudiant,matricule_etudiant',
            'code_session'  => 'sometimes|required|string|exists:session,code_session',
            'montant_paye'  => 'sometimes|required|numeric|min:0',
            'id_compte'     => 'sometimes|required|integer|exists:compte,id_compte',
            'lieu_paiement' => 'sometimes|required|string',
        ]);

        $newMatricule = $request->matricule    ?? $original->matricule_etudiant;
        $newSession   = $request->code_session ?? $original->code_session;
        $newMontant   = $request->has('montant_paye') ? floatval($request->montant_paye) : floatval($original->montant_paye);
        $newCompte    = $request->id_compte    ?? (int)$original->type_paiement;
        $newLieu      = $request->lieu_paiement ?? $original->lieu_paiement;

        $matriculeChanged = $newMatricule !== $original->matricule_etudiant;
        $sessionChanged   = $newSession   !== $original->code_session;
        $montantChanged   = $newMontant   != floatval($original->montant_paye);
        $compteChanged    = $newCompte    != (int)$original->type_paiement;

        DB::beginTransaction();
        try {
            if ($montantChanged || $compteChanged) {
                $this->ajusterSoldeCompte((int)$original->type_paiement, floatval($original->montant_paye), 'S', 'correction recouvrement #' . $id);
                $this->ajusterSoldeCompte($newCompte, $newMontant, 'E', 'correction recouvrement #' . $id);
            }

            DB::table('inscription')->where('id_paiement', $id)->update([
                'matricule_etudiant' => $newMatricule,
                'code_session'       => $newSession,
                'montant_paye'       => $newMontant,
                'type_paiement'      => $newCompte,
                'lieu_paiement'      => $newLieu,
            ]);

            if ($matriculeChanged || $sessionChanged) {
                $this->recalculerResteAPayer($original->matricule_etudiant, $original->code_session);
            }
            $this->recalculerResteAPayer($newMatricule, $newSession);

            DB::commit();
            return $this->ok('Recouvrement mis à jour avec recalcul automatique');

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la mise à jour', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        $row = DB::table('inscription')->where('id_paiement', $id)->first();
        if (!$row) return $this->err('Recouvrement non trouvé', 404);

        DB::beginTransaction();
        try {
            $this->ajusterSoldeCompte((int)$row->type_paiement, floatval($row->montant_paye), 'S', 'suppression recouvrement #' . $id);

            DB::table('inscription')->where('id_paiement', $id)->delete();

            $this->recalculerResteAPayer($row->matricule_etudiant, $row->code_session);

            DB::commit();
            return $this->ok('Supprimé');

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la suppression', 'error' => $e->getMessage()], 500);
        }
    }
}