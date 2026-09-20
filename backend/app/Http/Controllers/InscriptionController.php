<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Concerns\GeneratesFactureNumero;

class InscriptionController extends BaseApiController
{
    // FIX : même numérotation de facture que le module Facture — voir le trait.
    use GeneratesFactureNumero;

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
                // FIX : id brut du compte, nécessaire pour pré-remplir le
                // select "Compte encaissement" en édition (avant, seul le
                // libellé texte était renvoyé, impossible de le remapper
                // fiablement vers un id_compte pour le formulaire).
                'i.type_paiement      as id_compte',
                DB::raw("IFNULL(c.libelle, i.type_paiement) as compte"),
                'i.lieu_paiement',
                DB::raw("CONCAT(IFNULL(sal.nom_s,''),' ',IFNULL(sal.prenom_s,'')) as editeur")
            );

        return $this->paginate($query, $request,
            ['i.matricule_etudiant','e.nom_etudiant','e.prenom_etudiant','i.code_session'],
            'i.id_paiement'
        );
    }

    // FIX : recalculerResteAPayer() et ajusterSoldeCompte() sont désormais
    // dans BaseApiController (partagées avec RecouvrementController, même
    // table `inscription`) — plus de duplication.

    public function store(Request $request)
    {
        $request->validate([
            'matricule'     => 'required|string|exists:etudiant,matricule_etudiant',
            'code_session'  => 'required|string|exists:session,code_session',
            'montant_paye'  => 'required|numeric|min:0',
            'id_compte'     => 'required|integer|exists:compte,id_compte',
            'lieu_paiement' => 'required|string',
        ]);

        DB::beginTransaction();
        try {
            $this->ajusterSoldeCompte((int)$request->id_compte, (float)$request->montant_paye, 'E', 'inscription');

            $numero = $this->generateNumeroFacture();
            $refFacture = DB::table('facture')->insertGetId([
                'numero_facture' => $numero,
                'matricule_s'    => auth()->user()->matricule ?? null,
            ], 'ref_facture');

            // FIX : reste_a_payer inséré à 0 en placeholder — recalculé juste
            // après par recalculerResteAPayer(), source unique de vérité.
            DB::table('inscription')->insert([
                'matricule_etudiant' => $request->matricule,
                'code_session'       => $request->code_session,
                'date_paiement'      => $request->date_paiement ?? now(),
                'montant_paye'       => $request->montant_paye,
                'type_paiement'      => $request->id_compte,
                'lieu_paiement'      => $request->lieu_paiement,
                'reste_a_payer'      => 0,
                'ref_facture'        => $refFacture,
                'matricule_s'        => auth()->user()->matricule ?? null,
            ]);

            $this->recalculerResteAPayer($request->matricule, $request->code_session);

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
        $original = DB::table('inscription')->where('id_paiement', $id)->first();
        if (!$original) return $this->err('Inscription non trouvée', 404);

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
            // FIX : si le montant ou le compte change, on reverse l'ancien
            // mouvement et on applique le nouveau — au lieu d'écraser
            // silencieusement le champ sans toucher au solde comme avant.
            if ($montantChanged || $compteChanged) {
                $this->ajusterSoldeCompte((int)$original->type_paiement, floatval($original->montant_paye), 'S', 'correction inscription #' . $id);
                $this->ajusterSoldeCompte($newCompte, $newMontant, 'E', 'correction inscription #' . $id);
            }

            DB::table('inscription')->where('id_paiement', $id)->update([
                'matricule_etudiant' => $newMatricule,
                'code_session'       => $newSession,
                'montant_paye'       => $newMontant,
                'type_paiement'      => $newCompte,
                'lieu_paiement'      => $newLieu,
            ]);

            // Si l'étudiant ou la session a changé, l'ANCIEN groupe perd ce
            // paiement — sa chaîne doit être recalculée aussi (les paiements
            // suivants de ce groupe avaient un reste_a_payer qui supposait
            // que ce paiement leur appartenait toujours).
            if ($matriculeChanged || $sessionChanged) {
                $this->recalculerResteAPayer($original->matricule_etudiant, $original->code_session);
            }
            // Le nouveau groupe (qui peut être le même qu'avant si rien n'a
            // changé côté étudiant/session, mais le montant si) est toujours
            // recalculé.
            $this->recalculerResteAPayer($newMatricule, $newSession);

            DB::commit();
            return $this->ok('Inscription mise à jour avec recalcul automatique');

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la mise à jour', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        $row = DB::table('inscription')->where('id_paiement', $id)->first();
        if (!$row) return $this->err('Inscription non trouvée', 404);

        DB::beginTransaction();
        try {
            // FIX : reverse le solde du compte avant de supprimer — avant,
            // l'argent restait comptabilisé pour toujours après suppression.
            $this->ajusterSoldeCompte((int)$row->type_paiement, floatval($row->montant_paye), 'S', 'suppression inscription #' . $id);

            DB::table('inscription')->where('id_paiement', $id)->delete();

            // Recalcule ce qui reste dans ce groupe étudiant/session, en
            // l'absence de ce paiement supprimé.
            $this->recalculerResteAPayer($row->matricule_etudiant, $row->code_session);

            DB::commit();
            return $this->ok('Inscription supprimée avec succès');

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la suppression', 'error' => $e->getMessage()], 500);
        }
    }

    // ── Liste des comptes (pour le select) ──
    public function comptes()
    {
        return response()->json(DB::table('compte')->select('id_compte', 'libelle')->get());
    }
}