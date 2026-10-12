<?php
namespace App\Http\Controllers;

use App\Services\DepenseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// SUIVI DES DÉPENSES (statuts, validation, paiement, annulation) : actif
// seulement si DepenseService::actif() — voir config/depenses.php. Désactivé,
// les méthodes ci-dessous se comportent exactement comme avant et ne touchent
// aucune des colonnes ajoutées par les migrations 2026_10_11_* / 2026_10_12_*.
// Les règles elles-mêmes sont dans App\Services\DepenseService.
class LogistiqueController extends BaseApiController
{
    // Messages français des validations d'un achat et d'une charge. Les règles
    // elles-mêmes ne changent pas : seul le texte des refus (422) est traduit,
    // l'application n'ayant pas de fichier de traduction.
    private const MESSAGES_ACHAT = [
        'nom_materiel.required'  => 'Le nom du matériel est obligatoire.',
        'nom_materiel.string'    => 'Le nom du matériel doit être un texte.',
        'nom_materiel.max'       => 'Le nom du matériel ne doit pas dépasser 255 caractères.',
        'prix_unitaire.required' => 'Le prix unitaire est obligatoire.',
        'prix_unitaire.numeric'  => 'Le prix unitaire doit être un nombre.',
        'prix_unitaire.min'      => 'Le prix unitaire ne peut pas être négatif.',
        'quantite.required'      => 'La quantité est obligatoire.',
        'quantite.integer'       => 'La quantité doit être un nombre entier.',
        'quantite.min'           => 'La quantité doit être au moins 1.',
        'date_achat.required'    => "La date d'achat est obligatoire.",
        'date_achat.date'        => "La date d'achat n'est pas une date valide.",
    ];

    private const MESSAGES_CHARGE = [
        'designation.required' => 'La désignation est obligatoire.',
        'designation.string'   => 'La désignation doit être un texte.',
        'designation.max'      => 'La désignation ne doit pas dépasser 255 caractères.',
        'montant.required'     => 'Le montant est obligatoire.',
        'montant.numeric'      => 'Le montant doit être un nombre.',
        'montant.min'          => 'Le montant ne peut pas être négatif.',
        'mois.required'        => 'Le mois est obligatoire.',
        'mois.integer'         => 'Le mois doit être un nombre entre 1 et 12.',
        'mois.between'         => 'Le mois doit être un nombre entre 1 et 12.',
        'annee.required'       => "L'année est obligatoire.",
        'annee.integer'        => "L'année doit être un nombre entier.",
        'annee.min'            => "L'année doit être 2000 ou plus.",
        'date.required'        => 'La date est obligatoire.',
        'date.date'            => "La date n'est pas une date valide.",
    ];

    // Suivi ACTIVÉ uniquement : ajoute à chaque ligne de la liste le booléen
    // « est_auteur » — l'utilisateur connecté est-il celui qui a saisi cette
    // dépense ? L'écran s'en sert pour proposer « Annuler » à l'auteur.
    //  - Même comparaison que DepenseService::annuler() : l'identifiant gardé
    //    dans matricule_s contre l'identifiant de l'utilisateur connecté,
    //    jamais les noms affichés. Une dépense de l'ancien système n'a pas
    //    d'identifiant d'auteur : est_auteur y est toujours faux.
    //  - L'identifiant de l'auteur lui-même (« _auteur ») ne sort pas du
    //    serveur : il est retiré de la réponse.
    //  - Ce booléen ne donne aucun droit : l'annulation reste contrôlée par
    //    DepenseService (auteur ou administrateur, statut, motif).
    // Suivi désactivé : la réponse est renvoyée telle quelle, sans ce champ.
    private function avecEstAuteur(JsonResponse $reponse): JsonResponse
    {
        if (!DepenseService::actif()) {
            return $reponse;
        }

        $corps = $reponse->getData(true);
        $moi   = (string) auth()->id();

        foreach ($corps['data'] ?? [] as $i => $ligne) {
            $corps['data'][$i]['est_auteur'] = $moi !== '' && (string) ($ligne['_auteur'] ?? '') === $moi;
            unset($corps['data'][$i]['_auteur']);
        }

        return $reponse->setData($corps);
    }

    // État du suivi des dépenses, pour les écrans : ils n'affichent les
    // statuts et les actions (valider, payer, annuler) que s'il est activé.
    // Ne lit pas la base et ne renvoie que ce booléen.
    public function etatSuivi()
    {
        return response()->json(['suivi_actif' => DepenseService::actif()]);
    }

    /* ═══════════════════════════════════════════
     *  ACHAT
     * ═══════════════════════════════════════════ */
    public function indexAchat(Request $request)
    {
        $query = DB::table('achat as a')
            ->leftJoin('users as u', 'a.matricule_s', '=', 'u.id')
            ->select(
                'a.id_achat',
                'a.nom_materiel',
                'a.prix_unitaire',
                'a.quantite',
                'a.montant',
                'a.date_achat',
                'a.photo_achat',
                DB::raw("IFNULL(u.name,'') as editeur")
            );

        if (DepenseService::actif()) {
            $query->leftJoin('compte as cp', 'a.id_compte', '=', 'cp.id_compte')
                ->addSelect('a.statut', 'a.id_compte', DB::raw("IFNULL(cp.libelle,'') as compte"),
                    'a.date_validation', 'a.date_paiement', 'a.ancien_systeme', 'a.matricule_s as _auteur');
        }

        if ($request->filled('date_debut')) $query->whereDate('a.date_achat', '>=', $request->date_debut);
        if ($request->filled('date_fin'))   $query->whereDate('a.date_achat', '<=', $request->date_fin);

        return $this->avecEstAuteur($this->paginate($query, $request, ['a.nom_materiel'], 'a.id_achat'));
    }

    public function storeAchat(Request $request)
    {
        $request->validate([
            'nom_materiel'  => 'required|string|max:255',
            'prix_unitaire' => 'required|numeric|min:0',
            'quantite'      => 'required|integer|min:1',
            'date_achat'    => 'required|date',
        ], self::MESSAGES_ACHAT);

        $id = DB::transaction(function () use ($request) {
            $id = DB::table('achat')->insertGetId([
                'nom_materiel'   => $request->nom_materiel,
                'prix_unitaire'  => $request->prix_unitaire,
                'quantite'       => $request->quantite,
                'montant'        => $request->prix_unitaire * $request->quantite,
                'date_achat'     => $request->date_achat,
                'photo_achat'    => $request->photo_achat    ?? '',
                // FIX : avec le suivi des dépenses, le numéro d'écriture n'est
                // jamais pris dans la requête — seul le paiement le renseigne.
                'id_transaction' => DepenseService::actif() ? 0 : ($request->id_transaction ?? 0),
                // FIX : capture de l'éditeur, absente jusqu'ici
                'matricule_s'    => auth()->id(),
            ]);

            if (DepenseService::actif()) {
                $this->depenses()->apresSaisie('achat', $id, (float) ($request->prix_unitaire * $request->quantite), (int) auth()->id());
            }

            return $id;
        });

        return $this->ok('Achat enregistré', ['id' => $id], 201);
    }

    public function updateAchat(Request $request, $id)
    {
        $request->validate([
            'nom_materiel'  => 'required|string|max:255',
            'prix_unitaire' => 'required|numeric|min:0',
            'quantite'      => 'required|integer|min:1',
            'date_achat'    => 'required|date',
        ], self::MESSAGES_ACHAT);

        DB::transaction(function () use ($request, $id) {
            // Toujours appelé : l'autorisation (auteur ou admin) ne dépend pas
            // du suivi des dépenses ; le reste, si. Voir DepenseService.
            $this->depenses()->avantModification('achat', (int) $id, (float) ($request->prix_unitaire * $request->quantite), (int) auth()->id(), $this->estAdmin());

            DB::table('achat')->where('id_achat', $id)->update([
                'nom_materiel'  => $request->nom_materiel,
                'prix_unitaire' => $request->prix_unitaire,
                'quantite'      => $request->quantite,
                'montant'       => $request->prix_unitaire * $request->quantite,
                'date_achat'    => $request->date_achat,
                'photo_achat'   => $request->photo_achat ?? '',
            ]);
        });

        return $this->ok('Achat modifié');
    }

    public function destroyAchat($id)
    {
        DB::transaction(function () use ($id) {
            if (DepenseService::actif()) {
                $this->depenses()->avantSuppression('achat', (int) $id, (int) auth()->id());
            }

            DB::table('achat')->where('id_achat', $id)->delete();
        });

        return $this->ok('Achat supprimé');
    }

    public function uploadPhotoAchat(Request $request, $id)
    {
        $request->validate(['photo' => 'required|image|max:2048']);
        $path = $request->file('photo')->store('achats', 'public');
        DB::table('achat')->where('id_achat', $id)->update(['photo_achat' => $path]);
        return response()->json(['path' => $path]);
    }

    /* ═══════════════════════════════════════════
     *  CHARGE
     * ═══════════════════════════════════════════ */
    public function indexCharge(Request $request)
    {
        $query = DB::table('charge as c')
            ->leftJoin('users as u', 'c.matricule_s', '=', 'u.id')
            ->select(
                'c.id_charge',
                'c.designation',
                'c.montant',
                'c.mois',
                'c.annee',
                'c.date',
                'c.photo_charge',
                DB::raw("IFNULL(u.name,'') as editeur")
            );

        if (DepenseService::actif()) {
            $query->leftJoin('compte as cp', 'c.id_compte', '=', 'cp.id_compte')
                ->addSelect('c.statut', 'c.id_compte', DB::raw("IFNULL(cp.libelle,'') as compte"),
                    'c.date_validation', 'c.date_paiement', 'c.ancien_systeme', 'c.matricule_s as _auteur');
        }

        if ($request->filled('mois'))       $query->where('c.mois',  $request->mois);
        if ($request->filled('annee'))      $query->where('c.annee', $request->annee);
        if ($request->filled('date_debut')) $query->whereDate('c.date', '>=', $request->date_debut);
        if ($request->filled('date_fin'))   $query->whereDate('c.date', '<=', $request->date_fin);

        return $this->avecEstAuteur($this->paginate($query, $request, ['c.designation'], 'c.id_charge'));
    }

    public function storeCharge(Request $request)
    {
        $request->validate([
            'designation' => 'required|string|max:255',
            'montant'     => 'required|numeric|min:0',
            'mois'        => 'required|integer|between:1,12',
            'annee'       => 'required|integer|min:2000',
            'date'        => 'required|date',
        ], self::MESSAGES_CHARGE);

        $id = DB::transaction(function () use ($request) {
            $id = DB::table('charge')->insertGetId([
                'designation'    => $request->designation,
                'montant'        => $request->montant,
                'mois'           => $request->mois,
                'annee'          => $request->annee,
                'date'           => $request->date,
                'photo_charge'   => $request->photo_charge   ?? '',
                // FIX : même règle que pour les achats (voir storeAchat).
                'id_transaction' => DepenseService::actif() ? 0 : ($request->id_transaction ?? 0),
                // FIX : capture de l'éditeur, absente jusqu'ici
                'matricule_s'    => auth()->id(),
            ]);

            if (DepenseService::actif()) {
                $this->depenses()->apresSaisie('charge', $id, (float) $request->montant, (int) auth()->id());
            }

            return $id;
        });

        return $this->ok('Charge enregistrée', ['id' => $id], 201);
    }

    public function updateCharge(Request $request, $id)
    {
        $request->validate([
            'designation' => 'required|string|max:255',
            'montant'     => 'required|numeric|min:0',
            'mois'        => 'required|integer|between:1,12',
            'annee'       => 'required|integer|min:2000',
            'date'        => 'required|date',
        ], self::MESSAGES_CHARGE);

        DB::transaction(function () use ($request, $id) {
            // Toujours appelé (voir updateAchat).
            $this->depenses()->avantModification('charge', (int) $id, (float) $request->montant, (int) auth()->id(), $this->estAdmin());

            DB::table('charge')->where('id_charge', $id)->update([
                'designation'  => $request->designation,
                'montant'      => $request->montant,
                'mois'         => $request->mois,
                'annee'        => $request->annee,
                'date'         => $request->date,
                'photo_charge' => $request->photo_charge ?? '',
            ]);
        });

        return $this->ok('Charge modifiée');
    }

    public function destroyCharge($id)
    {
        DB::transaction(function () use ($id) {
            if (DepenseService::actif()) {
                $this->depenses()->avantSuppression('charge', (int) $id, (int) auth()->id());
            }

            DB::table('charge')->where('id_charge', $id)->delete();
        });

        return $this->ok('Charge supprimée');
    }

    /* ═══════════════════════════════════════════
     *  SUIVI DES DÉPENSES — valider, payer, annuler, historique
     *  Une méthode par route ; la logique commune est juste en dessous.
     * ═══════════════════════════════════════════ */
    public function validerAchat($id)                              { return $this->validerDepense('achat', $id); }
    public function payerAchat(Request $request, $id)              { return $this->payerDepense($request, 'achat', $id); }
    public function annulerPaiementAchat(Request $request, $id)    { return $this->annulerPaiementDepense($request, 'achat', $id); }
    public function annulerAchat(Request $request, $id)            { return $this->annulerDepense($request, 'achat', $id); }
    public function historiqueAchat($id)                           { return $this->historiqueDepense('achat', $id); }

    public function validerCharge($id)                             { return $this->validerDepense('charge', $id); }
    public function payerCharge(Request $request, $id)             { return $this->payerDepense($request, 'charge', $id); }
    public function annulerPaiementCharge(Request $request, $id)   { return $this->annulerPaiementDepense($request, 'charge', $id); }
    public function annulerCharge(Request $request, $id)           { return $this->annulerDepense($request, 'charge', $id); }
    public function historiqueCharge($id)                          { return $this->historiqueDepense('charge', $id); }

    private function depenses(): DepenseService
    {
        return app(DepenseService::class);
    }

    /** Rôle admin — même critère que AdminOnlyDelete et AuthController::createUser. */
    private function estAdmin(): bool
    {
        return auth()->user()?->roleRelation?->slug === 'admin';
    }

    /** Réponse des nouvelles routes quand le suivi des dépenses est désactivé. */
    private function suiviDesactive()
    {
        return DepenseService::actif()
            ? null
            : $this->err("Le suivi des dépenses n'est pas activé sur cette installation.", 409);
    }

    private function validerDepense(string $type, $id)
    {
        if ($refus = $this->suiviDesactive()) return $refus;

        $depense = $this->depenses()->valider($type, (int) $id, (int) auth()->id());

        return $this->ok('Dépense validée.', ['depense' => $depense]);
    }

    private function payerDepense(Request $request, string $type, $id)
    {
        if ($refus = $this->suiviDesactive()) return $refus;

        $request->validate(
            ['id_compte' => 'required|integer'],
            ['id_compte.required' => 'Choisissez le compte à débiter.', 'id_compte.integer' => "Le compte choisi n'existe pas."]
        );

        $depense = $this->depenses()->payer($type, (int) $id, (int) $request->id_compte, (int) auth()->id());

        return $this->ok('Dépense payée.', ['depense' => $depense]);
    }

    private function annulerPaiementDepense(Request $request, string $type, $id)
    {
        if ($refus = $this->suiviDesactive()) return $refus;

        $this->validerMotif($request);
        $depense = $this->depenses()->annulerPaiement($type, (int) $id, (string) $request->motif, (int) auth()->id());

        return $this->ok('Paiement annulé : le compte a été recrédité.', ['depense' => $depense]);
    }

    private function annulerDepense(Request $request, string $type, $id)
    {
        if ($refus = $this->suiviDesactive()) return $refus;

        $this->validerMotif($request);
        // Administrateur = titulaire de depenses.valider ; sinon seul l'auteur de la saisie peut annuler.
        $estAdmin = (bool) $request->user()?->hasPermission('depenses.valider');
        $depense  = $this->depenses()->annuler($type, (int) $id, (string) $request->motif, (int) auth()->id(), $estAdmin);

        return $this->ok('Dépense annulée.', ['depense' => $depense]);
    }

    private function historiqueDepense(string $type, $id)
    {
        if ($refus = $this->suiviDesactive()) return $refus;

        return response()->json(['data' => $this->depenses()->historique($type, (int) $id)]);
    }

    private function validerMotif(Request $request): void
    {
        $request->validate(
            ['motif' => 'required|string|max:255'],
            ['motif.required' => 'Le motif est obligatoire.', 'motif.max' => 'Le motif ne doit pas dépasser 255 caractères.']
        );
    }

    /* ═══════════════════════════════════════════
     *  RETOUR (retour de matériel / fournisseur)
     * ═══════════════════════════════════════════ */
    public function indexRetour(Request $request)
    {
        $query = DB::table('retour as r')
            ->leftJoin('achat as a', 'r.id_achat', '=', 'a.id_achat')
            ->select(
                'r.id_retour',
                'r.id_achat',
                'r.motif',
                'r.quantite_retour',
                'r.montant_retour',
                'r.date_retour',
                'r.statut',
                DB::raw("IFNULL(a.nom_materiel,'') as nom_materiel")
            );

        if ($request->filled('statut')) $query->where('r.statut', $request->statut);
        if ($request->filled('date_debut')) $query->whereDate('r.date_retour', '>=', $request->date_debut);
        if ($request->filled('date_fin'))   $query->whereDate('r.date_retour', '<=', $request->date_fin);

        return $this->paginate($query, $request, ['r.motif', 'a.nom_materiel'], 'r.id_retour');
    }

    public function storeRetour(Request $request)
    {
        $request->validate([
            'id_achat'        => 'required|integer',
            'motif'           => 'required|string|max:500',
            'quantite_retour' => 'required|integer|min:1',
            'date_retour'     => 'required|date',
            'statut'          => 'required|in:en_attente,accepte,refuse',
        ]);

        $achat = DB::table('achat')->where('id_achat', $request->id_achat)->first();
        $montant = $achat ? $achat->prix_unitaire * $request->quantite_retour : 0;

        $id = DB::table('retour')->insertGetId([
            'id_achat'        => $request->id_achat,
            'motif'           => $request->motif,
            'quantite_retour' => $request->quantite_retour,
            'montant_retour'  => $montant,
            'date_retour'     => $request->date_retour,
            'statut'          => $request->statut,
        ]);

        return $this->ok('Retour enregistré', ['id' => $id], 201);
    }

    public function updateRetour(Request $request, $id)
    {
        $request->validate([
            'motif'           => 'required|string|max:500',
            'quantite_retour' => 'required|integer|min:1',
            'date_retour'     => 'required|date',
            'statut'          => 'required|in:en_attente,accepte,refuse',
        ]);

        $retour = DB::table('retour')->where('id_retour', $id)->first();
        $achat  = $retour ? DB::table('achat')->where('id_achat', $retour->id_achat)->first() : null;
        $montant = $achat ? $achat->prix_unitaire * $request->quantite_retour : 0;

        DB::table('retour')->where('id_retour', $id)->update([
            'motif'           => $request->motif,
            'quantite_retour' => $request->quantite_retour,
            'montant_retour'  => $montant,
            'date_retour'     => $request->date_retour,
            'statut'          => $request->statut,
        ]);

        return $this->ok('Retour modifié');
    }

    public function destroyRetour($id)
    {
        DB::table('retour')->where('id_retour', $id)->delete();
        return $this->ok('Retour supprimé');
    }

    /* ═══════════════════════════════════════════
     *  AUTRE (dépenses diverses)
     * ═══════════════════════════════════════════ */
    public function indexAutre(Request $request)
    {
        $query = DB::table('autre_depense')->orderBy('id', 'desc');
        return $this->paginate($query, $request, ['designation'], 'id');
    }

    public function storeAutre(Request $request)
    {
        $request->validate([
            'designation' => 'required|string|max:255',
            'montant'     => 'required|numeric|min:0',
        ]);
        $id = DB::table('autre_depense')->insertGetId([
            'designation' => $request->designation,
            'montant'     => $request->montant,
            'date'        => $request->date ?? now()->toDateString(),
        ]);
        return $this->ok('Dépense enregistrée', ['id' => $id], 201);
    }

    public function destroyAutre($id)
    {
        DB::table('autre_depense')->where('id', $id)->delete();
        return $this->ok('Dépense supprimée');
    }
}