<?php
namespace App\Http\Controllers;

use App\Services\DepenseService;
use Illuminate\Database\Query\Builder;
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
     *  LISTES, TOTAUX ET EXPORTS (achats et charges)
     *
     *  FIX : l'écran additionnait les lignes de la page affichée et présentait
     *  ce chiffre comme le total de la liste (« 299 achats — Total : 324 700 Ar »
     *  pour les 15 premières lignes), et son export ne contenait que cette page.
     *
     *  Une SEULE requête filtrée par type de dépense (requeteAchats(),
     *  requeteCharges()) sert maintenant à la liste, à ses totaux et à
     *  l'export : filtres et recherche ne sont écrits qu'une fois et ne
     *  peuvent pas diverger.
     *
     *  Toutes les lectures d'une même réponse se font dans UNE transaction :
     *  avec InnoDB en REPEATABLE READ, elles voient la même image de la base
     *  (même procédé que IndicateursTresorerieService::indicateurs()). Aucun
     *  verrou n'est posé : ces lectures ne bloquent aucune écriture.
     * ═══════════════════════════════════════════ */

    /** Recherche « contient » sur les colonnes données — la même règle que BaseApiController::paginate(). */
    private function rechercher(Builder $query, Request $request, array $colonnes): Builder
    {
        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(function ($sub) use ($q, $colonnes) {
                foreach ($colonnes as $col) {
                    $sub->orWhere($col, 'like', "%{$q}%");
                }
            });
        }

        return $query;
    }

    // Totaux de TOUTES les lignes de la requête filtrée, jamais d'une page.
    //  - total_montant : toutes les lignes enregistrées, dépenses annulées
    //    comprises. TOUJOURS renvoyé ; ne lit aucune colonne du suivi.
    //  - total_actif   : suivi ACTIVÉ uniquement — les mêmes lignes, moins les
    //    dépenses annulées. Suivi désactivé, ce champ n'existe pas.
    // Travaille sur des copies : la requête reçue n'est pas modifiée.
    private function totaux(Builder $query, string $alias): array
    {
        $totaux = ['total_montant' => (float) (clone $query)->sum("{$alias}.montant")];

        if (DepenseService::actif()) {
            $totaux['total_actif'] = (float) (clone $query)
                ->whereRaw("COALESCE({$alias}.statut, '') <> ?", [DepenseService::ANNULEE])
                ->sum("{$alias}.montant");
        }

        return $totaux;
    }

    // Liste paginée + totaux de toute la liste. La recherche est déjà dans la
    // requête : paginate() n'en reçoit donc aucune colonne (sinon elle serait
    // appliquée deux fois). La réponse garde ses sept champs de pagination ;
    // les totaux s'y ajoutent.
    private function liste(Request $request, Builder $query, string $alias, string $cle): JsonResponse
    {
        return DB::transaction(function () use ($request, $query, $alias, $cle) {
            $totaux  = $this->totaux($query, $alias);
            $reponse = $this->avecEstAuteur($this->paginate($query, $request, [], $cle));

            return $reponse->setData($reponse->getData(true) + $totaux);
        });
    }

    /** Nombre maximal de lignes d'un export : config/depenses.php, clé « export_max » (20 000 si elle est absente). */
    private function exportMax(): int
    {
        return max(1, (int) config('depenses.export_max', 20000));
    }

    // Export : TOUTES les lignes de la requête filtrée, leur nombre et leurs
    // totaux, dans UNE réponse et UNE transaction. L'écran en fait un fichier
    // CSV, après avoir vérifié que lignes, nombre et totaux concordent.
    //  - Mêmes champs que la liste (est_auteur compris, jamais « _auteur »).
    //  - Tri sur le numéro de la ligne, unique, du plus récent au plus ancien.
    //  - Au-delà du plafond, refus explicite : la réponse entière est tenue en
    //    mémoire par le serveur puis par le navigateur.
    private function exporter(Builder $query, string $alias, string $cle): JsonResponse
    {
        return DB::transaction(function () use ($query, $alias, $cle) {
            $nombre = (clone $query)->count();
            $max    = $this->exportMax();

            if ($nombre > $max) {
                return $this->err(sprintf(
                    "L'export est limité à %s lignes, et %s lignes correspondent à ces filtres. Réduisez la période ou précisez la recherche.",
                    number_format($max, 0, ',', ' '),
                    number_format($nombre, 0, ',', ' ')
                ), 422);
            }

            $totaux = $this->totaux($query, $alias);
            $lignes = (clone $query)->orderBy($cle, 'desc')->get();

            return $this->avecEstAuteur(response()->json(['data' => $lignes, 'total' => $nombre] + $totaux));
        });
    }

    /* ═══════════════════════════════════════════
     *  ACHAT
     * ═══════════════════════════════════════════ */
    /** Achats répondant aux filtres et à la recherche de la requête HTTP : la base commune de la liste, des totaux et de l'export. */
    private function requeteAchats(Request $request): Builder
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

        // FIX : l'écran envoie aussi « mois » et « annee » pour les achats, mais
        // ils n'étaient pas lus ici : ces deux filtres restaient sans effet.
        if ($request->filled('mois'))       $query->whereMonth('a.date_achat', (int) $request->mois);
        if ($request->filled('annee'))      $query->whereYear('a.date_achat', (int) $request->annee);
        if ($request->filled('date_debut')) $query->whereDate('a.date_achat', '>=', $request->date_debut);
        if ($request->filled('date_fin'))   $query->whereDate('a.date_achat', '<=', $request->date_fin);

        return $this->rechercher($query, $request, ['a.nom_materiel']);
    }

    public function indexAchat(Request $request)
    {
        return $this->liste($request, $this->requeteAchats($request), 'a', 'a.id_achat');
    }

    public function exportAchats(Request $request)
    {
        return $this->exporter($this->requeteAchats($request), 'a', 'a.id_achat');
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
    /** Charges répondant aux filtres et à la recherche de la requête HTTP : la base commune de la liste, des totaux et de l'export. */
    private function requeteCharges(Request $request): Builder
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

        return $this->rechercher($query, $request, ['c.designation']);
    }

    public function indexCharge(Request $request)
    {
        return $this->liste($request, $this->requeteCharges($request), 'c', 'c.id_charge');
    }

    public function exportCharges(Request $request)
    {
        return $this->exporter($this->requeteCharges($request), 'c', 'c.id_charge');
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
        return (bool) auth()->user()?->isAdmin();
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
        // FIX : la clé de cette table est id_autre, pas id — la liste répondait
        // en erreur 500 (« Champ 'id' inconnu »). Le tri (plus récent d'abord)
        // est posé par paginate().
        $query = DB::table('autre_depense');
        return $this->paginate($query, $request, ['designation'], 'id_autre');
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