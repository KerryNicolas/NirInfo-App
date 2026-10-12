<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CertificationController extends BaseApiController
{
    // Champs obligatoires du mode automatique (création ET modification) :
    // la validation côté serveur double celle du formulaire React.
    private const REGLES_OBLIGATOIRES = [
        'matricule'    => 'required|string|exists:etudiant,matricule_etudiant',
        'code_module'  => 'required|string|exists:module,code_module',
        'code_session' => 'required|string|exists:session,code_session',
    ];

    private const MESSAGES = [
        'matricule.required'    => 'Le matricule est obligatoire.',
        'matricule.exists'      => "Ce matricule ne correspond à aucun étudiant.",
        'code_module.required'  => 'Le module est obligatoire.',
        'code_module.exists'    => "Ce module n'existe pas.",
        'code_session.required' => 'La session est obligatoire.',
        'code_session.exists'   => "Cette session n'existe pas.",
    ];

    // Champs de la saisie manuelle (certificat sans fiche étudiant).
    private const REGLES_MANUEL = [
        'nom_complet'    => 'required|string|max:255',
        // Facultatif, texte libre : simple repère, SANS lien avec une fiche
        // étudiant (aucune règle « exists »).
        'matricule'      => 'nullable|string|max:255',
        'nom_formation'  => 'required|string|max:255',
        'date_naissance' => 'nullable|date',
        'lieu_naissance' => 'nullable|string|max:255',
        'date_debut'     => 'required|date',
        'date_fin'       => 'required|date|after_or_equal:date_debut',
        'lieu_paiement'  => 'nullable|string|max:255',
    ];

    private const MESSAGES_MANUEL = [
        'nom_complet.required'   => 'Le nom est obligatoire.',
        'nom_formation.required' => 'La formation est obligatoire.',
        'date_debut.required'    => 'La date de début de session est obligatoire.',
        'date_fin.required'      => 'La date de fin de session est obligatoire.',
        'date_fin.after_or_equal'=> 'La fin de session ne peut pas être avant le début.',
    ];

    // Générateur UNIQUE de référence, partagé par les certificats normaux
    // et manuels : une seule numérotation CERT-AAAA-XXXX, sans doublon.
    private function genererReference(): string
    {
        $last = DB::table('certificat')->orderBy('id', 'DESC')->first();
        $num  = $last ? ($last->id + 1) : 1;
        return 'CERT-' . date('Y') . '-' . str_pad($num, 4, '0', STR_PAD_LEFT);
    }

    // Doublon : un même étudiant ne reçoit pas deux certificats NORMAUX pour
    // le même module et les mêmes dates de session (règle de l'ancien
    // système). $saufId : certificat en cours de modification, à ignorer.
    private function existeDoublon($matricule, $codeModule, $debut, $fin, $saufId = null): bool
    {
        $q = DB::table('certificat')
            ->where('origine', 'normal')
            ->where('matricule', $matricule)
            ->where('code_module', $codeModule)
            ->whereDate('debut_session', $debut)
            ->whereDate('fin_session', $fin);
        if ($saufId) $q->where('id', '!=', $saufId);
        return $q->exists();
    }

    private const MSG_DOUBLON = 'Un certificat existe déjà pour cet étudiant, ce module et ces dates de session.';

    // Prix standard en vigueur (dernier prix défini), ou null.
    private function prixStandard()
    {
        return DB::table('prix_certificat')->orderBy('id_prix_certificat', 'DESC')->first()?->prix;
    }

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
                    // Certificat manuel : le nom et la naissance viennent des
                    // colonnes *_manuel, pas de la fiche étudiant.
                    DB::raw("IF(c.origine = 'manuel', IFNULL(c.nom_manuel,''), CONCAT(IFNULL(e.nom_etudiant,''),' ',IFNULL(e.prenom_etudiant,''))) as nom_complet"),
                    'c.origine',
                    'c.motif_gratuit',
                    'c.nom_formation',
                    // FIX : manquait totalement — l'ancien certificat FPDF affichait
                    // "Né(e) le ... à ..." juste sous le nom. Nécessaire pour la
                    // ligne ajoutée dans CertificatView (CertificationTab.tsx).
                    DB::raw("IF(c.origine = 'manuel', c.date_naissance_manuel, e.dn_etudiant) as date_naissance"),
                    DB::raw("IF(c.origine = 'manuel', c.lieu_naissance_manuel, e.ln_etudiant) as lieu_naissance"),
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
                ['c.matricule', 'e.nom_etudiant', 'e.prenom_etudiant', 'c.nom_manuel', 'c.reference', 'c.code_module'],
                'c.id'
            );
        } catch (\Exception $e) {
            return response()->json(['data' => [], 'total' => 0, 'error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        // Matricule, Module et Session sont obligatoires et doivent exister.
        $request->validate(self::REGLES_OBLIGATOIRES + [
            'prix' => 'nullable|numeric|min:0',
        ], self::MESSAGES);

        $session = null;
        if ($request->filled('code_session')) {
            $session = DB::table('session')->where('code_session', $request->code_session)->first();
        }

        $debut = $request->date_debut ?? ($session?->debut_session ?? now()->toDateString());
        $fin   = $request->date_fin   ?? ($session?->fin_session   ?? now()->toDateString());

        if ($this->existeDoublon($request->matricule, $request->code_module, $debut, $fin)) {
            return $this->err(self::MSG_DOUBLON, 422);
        }

        $reference = $this->genererReference();

        // Prix par défaut = dernier prix standard défini, si aucun prix fourni
        $prix = $request->prix ?: $this->prixStandard();

        DB::table('certificat')->insert([
            'reference'     => $reference,
            'matricule'     => $request->matricule,
            'code_module'   => $request->code_module,
            'debut_session' => $debut,
            'fin_session'   => $fin,
            'nom_formation' => $request->nom_formation_certificat ?? null,
            'lieu_paiement' => $request->lieu_paiement ?? null,
            'code_session'  => $request->code_session  ?? null,
            'accept'        => 0,
            'prix'          => $prix,
            'date'          => now(),
            'origine'       => 'normal',
        ]);

        return response()->json(['message' => 'Certificat créé, en attente de validation.', 'reference' => $reference], 201);
    }

    // Saisie manuelle (route réservée à l'admin) : crée un certificat SANS
    // fiche étudiant, module ni session. Il entre dans la même table et la
    // même liste, « En attente », puis suit le même circuit que les autres :
    // paiement + validation (valider()), puis impression.
    public function storeManuel(Request $request)
    {
        $request->validate(self::REGLES_MANUEL, self::MESSAGES_MANUEL);

        $reference = $this->genererReference();
        $prix      = $this->prixStandard();

        $id = DB::table('certificat')->insertGetId([
            'reference'             => $reference,
            'matricule'             => $request->matricule ?? null,
            'code_module'           => null,
            'code_session'          => null,
            'debut_session'         => $request->date_debut,
            'fin_session'           => $request->date_fin,
            'nom_formation'         => $request->nom_formation,
            'lieu_paiement'         => $request->lieu_paiement ?? null,
            'accept'                => 0,
            'prix'                  => $prix,
            'date'                  => now(),
            'origine'               => 'manuel',
            'nom_manuel'            => $request->nom_complet,
            'date_naissance_manuel' => $request->date_naissance ?? null,
            'lieu_naissance_manuel' => $request->lieu_naissance ?? null,
        ]);

        // Même forme qu'une ligne de index() : le front l'utilise tout de
        // suite pour la fenêtre de validation puis l'impression.
        return response()->json([
            'message'    => 'Certificat manuel enregistré, en attente de validation.',
            'reference'  => $reference,
            'certificat' => [
                'id'             => $id,
                'reference'      => $reference,
                'matricule'      => $request->matricule ?? null,
                'nom'            => '',
                'prenom'         => '',
                'nom_complet'    => $request->nom_complet,
                'date_naissance' => $request->date_naissance ?? null,
                'lieu_naissance' => $request->lieu_naissance ?? null,
                'code_module'    => null,
                'module_nom'     => $request->nom_formation,
                'nom_formation'  => $request->nom_formation,
                'debut_session'  => $request->date_debut,
                'fin_session'    => $request->date_fin,
                'accept'         => 0,
                'prix'           => $prix,
                'lieu_paiement'  => $request->lieu_paiement ?? null,
                'code_session'   => null,
                'origine'        => 'manuel',
            ],
        ], 201);
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

        // Certificat manuel : seuls les champs saisis à la main se corrigent
        // (le prix se fixe à la validation). Réservé à l'admin côté écran.
        if (($c->origine ?? 'normal') === 'manuel') {
            $request->validate(self::REGLES_MANUEL, self::MESSAGES_MANUEL);
            DB::table('certificat')->where('id', $c->id)->update([
                'nom_manuel'            => $request->nom_complet,
                'matricule'             => $request->matricule ?? null,
                'nom_formation'         => $request->nom_formation,
                'date_naissance_manuel' => $request->date_naissance ?? null,
                'lieu_naissance_manuel' => $request->lieu_naissance ?? null,
                'debut_session'         => $request->date_debut,
                'fin_session'           => $request->date_fin,
                'lieu_paiement'         => $request->lieu_paiement ?? $c->lieu_paiement,
            ]);
            return $this->ok('Certificat mis à jour avec succès');
        }

        // Mêmes champs obligatoires qu'à la création.
        $request->validate(self::REGLES_OBLIGATOIRES + [
            'prix' => 'nullable|numeric|min:0',
        ], self::MESSAGES);

        $session = null;
        if ($request->filled('code_session')) {
            $session = DB::table('session')->where('code_session', $request->code_session)->first();
        }

        $nouveauPrix = $request->prix ?? $c->prix;

        $debut = $request->date_debut ?? ($session?->debut_session ?? $c->debut_session);
        $fin   = $request->date_fin   ?? ($session?->fin_session   ?? $c->fin_session);
        if ($this->existeDoublon($request->matricule, $request->code_module, $debut, $fin, $c->id)) {
            return $this->err(self::MSG_DOUBLON, 422);
        }

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
                'debut_session' => $debut,
                'fin_session'   => $fin,
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
        $c = DB::table('certificat')->where('reference', $id)->first();
        if (!$c) return $this->err('Certificat non trouvé', 404);

        // Un certificat validé (payé ou gratuit) ne se supprime plus : il a
        // été délivré, et sa transaction doit rester cohérente avec lui.
        if ((int) $c->accept === 1) {
            return $this->err('Un certificat validé ne peut pas être supprimé.', 422);
        }

        DB::table('certificat')->where('id', $c->id)->delete();
        return $this->ok('Certificat supprimé');
    }

    // Validation finale — réservée à l'admin. Payante : crée la transaction.
    // Gratuite (certificat manuel + motif) : aucune écriture financière.
    public function valider(Request $request, $id)
    {
        $gratuit = $request->boolean('gratuit');

        $request->validate($gratuit ? [
            'motif_gratuit' => 'required|string|max:255',
        ] : [
            'id_compte' => 'required|integer|exists:compte,id_compte',
            'prix'      => 'nullable|numeric|min:0',
        ], [
            'motif_gratuit.required' => 'Le motif de gratuité est obligatoire.',
            'id_compte.required'     => 'Choisissez un compte d\'encaissement.',
        ]);

        $c = DB::table('certificat')->where('reference', $id)->orWhere('id', $id)->first();
        if (!$c) return $this->err('Certificat non trouvé', 404);

        // Un certificat ne se valide qu'une fois : sinon le paiement serait
        // enregistré deux fois dans le compte.
        if ((int) $c->accept === 1) {
            return $this->err('Ce certificat est déjà validé.', 422);
        }

        // Gratuité : uniquement pour un certificat MANUEL, avec un motif.
        // Aucune transaction ni mouvement de compte (pas d'écriture à 0 Ar).
        if ($gratuit) {
            if (($c->origine ?? 'normal') !== 'manuel') {
                return $this->err('Seul un certificat manuel peut être gratuit.', 422);
            }
            DB::table('certificat')->where('id', $c->id)->update([
                'accept'         => 1,
                'prix'           => 0,
                'id_transaction' => null,
                'motif_gratuit'  => $request->motif_gratuit,
                'date'           => now(),
            ]);
            return $this->ok('Certificat validé gratuitement, sans encaissement.');
        }

        // Sinon le paiement est obligatoire, normal ou manuel.
        $prixFinal = $request->prix ?? $c->prix ?? 0;
        if ((float) $prixFinal <= 0) {
            return $this->err('Le paiement est obligatoire : le prix doit être supérieur à 0.', 422);
        }

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
                // Date du certificat = date de validation (comme l'ancien
                // système) : « Montant perçu » compte par date de paiement.
                'date'           => now(),
            ]);

            DB::commit();
            return $this->ok('Certificat validé et paiement enregistré avec succès.');
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la validation.', 'error' => $e->getMessage()], 500);
        }
    }

    // Total perçu sur une période : réservé aux administrateurs (admin et
    // administrateur principal), comme l'onglet « Montant perçu » à l'écran.
    public function montant(Request $request)
    {
        if (!$request->user()?->isAdmin()) {
            return $this->err('Accès refusé.', 403);
        }

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