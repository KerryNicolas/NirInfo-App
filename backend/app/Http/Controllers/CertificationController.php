<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CertificationController extends BaseApiController
{
    public function index(Request $request)
    {
        try {
            $query = DB::table('certificat as c')
                ->leftJoin('etudiant as e', 'c.matricule',   '=', 'e.matricule_etudiant')
                ->leftJoin('module as m',   'c.code_module', '=', 'm.code_module')
                ->leftJoin('salarie as s',  'c.matricule_s', '=', 's.matricule_s')
                ->select(
                    'c.id',
                    'c.reference',
                    'c.matricule',
                    DB::raw("IFNULL(e.nom_etudiant,'')     as nom"),
                    DB::raw("IFNULL(e.prenom_etudiant,'')  as prenom"),
                    DB::raw("CONCAT(IFNULL(e.nom_etudiant,''),' ',IFNULL(e.prenom_etudiant,'')) as nom_complet"),
                    // FIX : manquait totalement — l'ancien certificat FPDF affichait
                    // "Né(e) le ... à ..." juste sous le nom. Nécessaire pour la
                    // ligne ajoutée dans CertificatView (CertificationTab.tsx).
                    'e.dn_etudiant as date_naissance',
                    'e.ln_etudiant as lieu_naissance',
                    'c.code_module',
                    DB::raw("IFNULL(c.nom_formation, m.nom_module) as module_nom"),
                    'c.debut_session',
                    'c.fin_session',
                    'c.date',
                    'c.accept',
                    'c.prix',
                    'c.lieu_paiement',
                    'c.code_session',
                    DB::raw("CONCAT(IFNULL(s.nom_s,''),' ',IFNULL(s.prenom_s,'')) as editeur")
                );

            return $this->paginate($query, $request,
                ['c.matricule', 'e.nom_etudiant', 'e.prenom_etudiant', 'c.reference', 'c.code_module'],
                'c.id'
            );
        } catch (\Exception $e) {
            return response()->json(['data' => [], 'total' => 0, 'error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        $request->validate([
            'matricule'   => 'required|string|exists:etudiant,matricule_etudiant',
            'code_module' => 'required|string',
        ]);

        $last      = DB::table('certificat')->orderBy('id', 'DESC')->first();
        $num       = $last ? ($last->id + 1) : 1;
        $reference = 'CERT-' . date('Y') . '-' . str_pad($num, 4, '0', STR_PAD_LEFT);

        $session = null;
        if ($request->filled('code_session')) {
            $session = DB::table('session')->where('code_session', $request->code_session)->first();
        }

        // Prix par défaut = dernier prix standard défini, si aucun prix fourni
        $prix = $request->prix;
        if (!$prix) {
            $dernierPrix = DB::table('prix_certificat')->orderBy('id_prix_certificat', 'DESC')->first();
            $prix = $dernierPrix?->prix;
        }

        DB::table('certificat')->insert([
            'reference'     => $reference,
            'matricule'     => $request->matricule,
            'code_module'   => $request->code_module,
            'debut_session' => $request->date_debut  ?? ($session?->debut_session ?? now()->toDateString()),
            'fin_session'   => $request->date_fin    ?? ($session?->fin_session   ?? now()->toDateString()),
            'nom_formation' => $request->nom_formation_certificat ?? null,
            'lieu_paiement' => $request->lieu_paiement ?? null,
            'code_session'  => $request->code_session  ?? null,
            'accept'        => 0,
            'prix'          => $prix,
            'date'          => now(),
        ]);

        return response()->json(['message' => 'Certificat créé, en attente de validation.', 'reference' => $reference], 201);
    }

    public function show($id)
    {
        $c = DB::table('certificat')->where('reference', $id)->first();
        if (!$c) return $this->err('Non trouvé', 404);
        return response()->json($c);
    }

    // FIX (point 11) : modification d'une certification — corrige une
    // erreur de saisie sans créer de doublon. On ne touche jamais à
    // "reference" (identifiant stable) ni à "accept" (le statut de
    // validation lui-même ne change que via valider()).
    // FIX : autorisé même sur un certificat déjà validé (accept=1) — dans
    // ce cas, si le prix change, on répercute la différence sur la
    // transaction et le solde du compte déjà enregistrés (même logique
    // que GererController::update), pour ne jamais laisser la
    // comptabilité désynchronisée du certificat corrigé.
    public function update(Request $request, $id)
    {
        $c = DB::table('certificat')->where('reference', $id)->orWhere('id', $id)->first();
        if (!$c) return $this->err('Certificat non trouvé', 404);

        $request->validate([
            'matricule'   => 'sometimes|required|string|exists:etudiant,matricule_etudiant',
            'code_module' => 'sometimes|required|string',
            'prix'        => 'nullable|numeric|min:0',
        ]);

        $session = null;
        if ($request->filled('code_session')) {
            $session = DB::table('session')->where('code_session', $request->code_session)->first();
        }

        $nouveauPrix = $request->prix ?? $c->prix;

        DB::beginTransaction();
        try {
            // Certificat déjà validé + prix modifié → ajuste la transaction
            // et le solde du compte déjà crédités, au lieu de les laisser
            // désynchronisés du nouveau prix.
            if ((int) $c->accept === 1 && $c->id_transaction && (float) $nouveauPrix !== (float) $c->prix) {
                $transaction = DB::table('transaction')->where('id_transaction', $c->id_transaction)->first();
                if ($transaction) {
                    DB::table('compte')->where('id_compte', $transaction->account)
                        ->decrement('montant', $transaction->amount);
                    DB::table('compte')->where('id_compte', $transaction->account)
                        ->increment('montant', $nouveauPrix);
                    DB::table('transaction')->where('id_transaction', $c->id_transaction)
                        ->update(['amount' => $nouveauPrix]);
                    DB::table('gestion_compte')->where('id_transaction', $c->id_transaction)
                        ->update(['montant' => $nouveauPrix]);
                }
            }

            DB::table('certificat')->where('id', $c->id)->update([
                'matricule'     => $request->matricule     ?? $c->matricule,
                'code_module'   => $request->code_module   ?? $c->code_module,
                'debut_session' => $request->date_debut     ?? ($session?->debut_session ?? $c->debut_session),
                'fin_session'   => $request->date_fin       ?? ($session?->fin_session   ?? $c->fin_session),
                'nom_formation' => $request->nom_formation_certificat ?? $c->nom_formation,
                'lieu_paiement' => $request->lieu_paiement  ?? $c->lieu_paiement,
                'code_session'  => $request->code_session   ?? $c->code_session,
                'prix'          => $nouveauPrix,
            ]);

            DB::commit();
            return $this->ok('Certificat mis à jour avec succès');
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la modification', 'error' => $e->getMessage()], 500);
        }
    }

    public function destroy($id)
    {
        DB::table('certificat')->where('reference', $id)->delete();
        return $this->ok('Certificat supprimé');
    }

    // Validation finale — réservée à l'admin, crée la transaction de paiement
    public function valider(Request $request, $id)
    {
        $request->validate([
            'id_compte' => 'required|integer|exists:compte,id_compte',
            'prix'      => 'nullable|numeric|min:0',
        ]);

        $c = DB::table('certificat')->where('reference', $id)->orWhere('id', $id)->first();
        if (!$c) return $this->err('Certificat non trouvé', 404);

        $prixFinal = $request->prix ?? $c->prix ?? 0;

        DB::beginTransaction();
        try {
            // 1. Créer la transaction (entrée)
            $idTransaction = DB::table('transaction')->insertGetId([
                'transaction_type' => 'E',
                'amount'           => $prixFinal,
                'reson'            => 'Certification ' . $c->reference,
                'account'          => $request->id_compte,
                'date_transaction' => now()->toDateString(),
            ]);

            // 2. Mettre à jour le solde du compte
            DB::table('compte')->where('id_compte', $request->id_compte)
                ->increment('montant', $prixFinal);

            // 3. Historiser dans gestion_compte
            DB::table('gestion_compte')->insert([
                'id_compte'      => $request->id_compte,
                'type'           => 'E',
                'montant'        => $prixFinal,
                'date_gestion'   => now()->toDateString(),
                'id_transaction' => $idTransaction,
            ]);

            // 4. Valider le certificat
            DB::table('certificat')->where('id', $c->id)->update([
                'accept'         => 1,
                'prix'           => $prixFinal,
                'id_transaction' => $idTransaction,
            ]);

            DB::commit();
            return $this->ok('Certificat validé et paiement enregistré avec succès.');
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la validation.', 'error' => $e->getMessage()], 500);
        }
    }

    public function montant(Request $request)
    {
        try {
            $query = DB::table('certificat')->whereNotNull('prix')->where('accept', 1);
            if ($request->filled('date_debut')) $query->whereDate('date', '>=', $request->date_debut);
            if ($request->filled('date_fin'))   $query->whereDate('date', '<=', $request->date_fin);
            return response()->json(['nb' => $query->count(), 'montant' => $query->sum('prix')]);
        } catch (\Exception $e) {
            return response()->json(['nb' => 0, 'montant' => 0]);
        }
    }

    // ── Gestion du prix standard des certificats ──
    public function getPrix()
    {
        $dernier = DB::table('prix_certificat')->orderBy('id_prix_certificat', 'DESC')->first();
        return response()->json(['prix' => $dernier?->prix ?? 0]);
    }

    public function getPrixHistorique()
    {
        $historique = DB::table('prix_certificat')->orderBy('id_prix_certificat', 'DESC')->get();
        return response()->json($historique);
    }

    public function setPrix(Request $request)
    {
        $request->validate(['prix' => 'required|integer|min:0']);

        DB::table('prix_certificat')->insert([
            'prix'              => $request->prix,
            'date_modification' => now()->toDateString(),
        ]);

        return $this->ok('Prix mis à jour avec succès.');
    }

    // FIX (point 2) : suppression d'une ligne de l'historique des prix —
    // le tableau n'avait aucun moyen de retirer une entrée erronée. On
    // empêche la suppression de la ligne la plus récente si c'est la
    // seule qui existe (il doit toujours rester au moins un prix
    // standard défini pour le calcul du prix par défaut dans store()).
    public function deletePrixHistorique($id)
    {
        $total = DB::table('prix_certificat')->count();
        if ($total <= 1) {
            return $this->err("Impossible de supprimer : il doit rester au moins un prix standard défini.", 422);
        }
        $deleted = DB::table('prix_certificat')->where('id_prix_certificat', $id)->delete();
        if (!$deleted) return $this->err('Entrée non trouvée', 404);
        return $this->ok('Entrée supprimée avec succès.');
    }

    // ── Comptes disponibles (pour le select de validation) ──
    public function comptes()
    {
        return response()->json(DB::table('compte')->select('id_compte', 'libelle')->get());
    }
}