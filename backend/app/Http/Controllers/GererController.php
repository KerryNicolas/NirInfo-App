<?php
namespace App\Http\Controllers;

use App\Services\DepenseService;
use App\Services\TresorerieService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GererController extends BaseApiController
{
    // FIX : cet écran modifie et supprime une écriture du journal par son
    // numéro. Avec le suivi de trésorerie, une écriture générée par
    // l'application et tracée — paiement d'une dépense, écriture d'un
    // virement, écriture inverse, sortie d'une dépense de l'ancien système —
    // ne doit plus pouvoir l'être ici : elle ne se corrige que depuis la
    // dépense ou le virement, par une compensation qui laisse une trace.
    // Sans effet si le suivi est désactivé.
    private function refusSiEcritureProtegee(object $transaction)
    {
        if (DepenseService::actif() && app(DepenseService::class)->ecritureProtegee($transaction)) {
            return $this->err("Cette écriture est rattachée à une dépense ou à un virement : elle ne peut être ni modifiée ni supprimée ici. Annulez l'opération depuis la dépense ou le virement.", 422);
        }

        return null;
    }

    // FIX : motifs réservés aux écritures que l'application génère elle-même.
    // index() masque ces motifs dans la liste : une opération manuelle saisie
    // sous l'un d'eux devenait invisible ici, et se confondait au journal avec
    // un encaissement ou une dépense. TOUJOURS appliqué.
    // Comparaison sans tenir compte de la casse ni des espaces autour (c'est
    // ainsi que la base compare ces textes). Correspondance EXACTE pour les
    // motifs simples : « Achat de balais » ou « Paiement salaire » restent
    // des motifs libres parfaitement valables.
    // « virement » : motif des écritures de virement (TresorerieService::MOTIF_VIREMENT).
    // « Transfert Mr » et autres libellés libres restent permis.
    private const MOTIFS_RESERVES = ['inscription', 'recouvrement', 'achat', 'charge', 'prestation', 'recouvrement_prestation', 'certificat', TresorerieService::MOTIF_VIREMENT];
    private const PREFIXES_RESERVES = [
        'certification ', 'correction inscription #', 'correction recouvrement #',
        'suppression inscription #', 'suppression recouvrement #',
    ];

    // Messages français de la validation d'une opération manuelle. Les règles
    // ne changent pas : seul le texte des refus (422) est traduit.
    private const MESSAGES_VALIDATION = [
        'compte.required'  => 'Choisissez un compte.',
        'compte.integer'   => "Le compte choisi n'existe pas.",
        'compte.exists'    => "Le compte choisi n'existe pas.",
        'type.required'    => "Le type d'opération est obligatoire.",
        'type.in'          => "Le type d'opération doit être un dépôt ou un retrait.",
        'montant.required' => 'Le montant est obligatoire.',
        'montant.numeric'  => 'Le montant doit être un nombre.',
        'montant.min'      => 'Le montant doit être supérieur à 0.',
        'raison.required'  => 'Le motif est obligatoire.',
        'raison.string'    => 'Le motif doit être un texte.',
        'raison.max'       => 'Le motif ne doit pas dépasser 255 caractères.',
    ];

    private function refusSiMotifReserve(?string $raison)
    {
        $motif = mb_strtolower(trim((string) $raison));

        $reserve = in_array($motif, self::MOTIFS_RESERVES, true);
        foreach (self::PREFIXES_RESERVES as $prefixe) {
            $reserve = $reserve || str_starts_with($motif . ' ', $prefixe) || str_starts_with($motif, $prefixe);
        }

        return $reserve
            ? $this->err("Ce motif est réservé aux écritures générées par l'application. Choisissez un autre libellé, par exemple « Achat de fournitures ».", 422)
            : null;
    }

    // ─── Liste des transactions manuelles (dépôts/retraits), en excluant celles
    // générées automatiquement par les autres modules (inscription, recouvrement,
    // charge, achat, prestation) — même logique que TransactionModel::getAll() en CI ──
    public function index(Request $request)
    {
        $exclus = ['inscription', 'recouvrement', 'charge', 'achat', 'prestation', 'recouvrement_prestation', 'certificat', TresorerieService::MOTIF_VIREMENT];

        $query = DB::table('transaction as t')
            ->join('compte as c', 't.account', '=', 'c.id_compte')
            ->leftJoin('users as u', 't.matricule_s', '=', 'u.id')
            ->whereNotIn('t.reson', $exclus)
            ->where('t.reson', 'NOT LIKE', 'Certification %')
            ->select(
                't.id_transaction',
                't.transaction_type',
                't.amount',
                't.reson',
                't.account',
                'c.account_number',
                'c.libelle',
                DB::raw("IFNULL(u.name, '') as editeur")
            );

        return $this->paginate($query, $request,
            ['t.reson', 'c.account_number', 'c.libelle'],
            't.id_transaction'
        );
    }

    // Dépôts et retraits manuels.
    //
    // FIX : le solde était vérifié AVANT la transaction et sans verrou — un
    // retrait lancé en même temps qu'un paiement ou qu'un virement pouvait
    // rendre le compte négatif. Les trois méthodes ci-dessous verrouillent
    // maintenant le ou les comptes, puis contrôlent leur existence et l'effet
    // NET de l'opération sur chaque solde, dans une seule transaction SQL.
    // TOUJOURS appliqué (aucune colonne du suivi n'est lue).
    // Une erreur inattendue donne un message en français, sans détail
    // technique (voir BaseApiController::proteger).

    public function store(Request $request)
    {
        $request->validate([
            'compte'  => 'required|integer|exists:compte,id_compte',
            'type'    => 'required|in:E,S',
            'montant' => 'required|numeric|min:1',
            'raison'  => 'required|string|max:255',
        ], self::MESSAGES_VALIDATION);

        if ($refus = $this->refusSiMotifReserve($request->raison)) return $refus;

        return $this->proteger("Erreur lors de l'enregistrement", fn () => DB::transaction(function () use ($request) {
            $compte  = (int) $request->compte;
            $comptes = $this->tresorerie()->verrouillerComptes([$compte]);
            $this->tresorerie()->exigerComptes($comptes, [$compte]);
            $this->tresorerie()->refuserDecouvert(
                $comptes,
                [$compte => $this->effet($request->type, (float) $request->montant)],
                [$compte => 'Solde insuffisant pour ce retrait']
            );

            DB::table('transaction')->insert([
                'transaction_type' => $request->type,
                'amount'           => $request->montant,
                'reson'            => $request->raison,
                'account'          => $request->compte,
                'matricule_s'      => auth()->id(),
            ]);

            if ($request->type === 'E') {
                DB::table('compte')->where('id_compte', $request->compte)->increment('montant', $request->montant);
            } else {
                DB::table('compte')->where('id_compte', $request->compte)->decrement('montant', $request->montant);
            }

            return $this->ok('Opération enregistrée avec succès', [], 201);
        }, 3));
    }

    // ─── Modification — annule l'effet de l'ancienne opération puis applique la nouvelle ──
    public function update(Request $request, $id)
    {
        $request->validate([
            'compte'  => 'required|integer|exists:compte,id_compte',
            'type'    => 'required|in:E,S',
            'montant' => 'required|numeric|min:1',
            'raison'  => 'required|string|max:255',
        ], self::MESSAGES_VALIDATION);

        if ($refus = $this->refusSiMotifReserve($request->raison)) return $refus;

        return $this->proteger('Erreur lors de la mise à jour', fn () => DB::transaction(function () use ($request, $id) {
            $original = DB::table('transaction')->where('id_transaction', $id)->lockForUpdate()->first();
            if (!$original) {
                return $this->err('Opération non trouvée', 404);
            }
            if ($refus = $this->refusSiEcritureProtegee($original)) return $refus;

            $ancienCompte = (int) $original->account;
            $compte       = (int) $request->compte;
            $comptes      = $this->tresorerie()->verrouillerComptes([$ancienCompte, $compte]);
            $this->tresorerie()->exigerComptes($comptes, [$compte]);

            // Effet net : l'ancienne opération est annulée, la nouvelle appliquée
            // (éventuellement sur un autre compte).
            $variations = [$ancienCompte => -$this->effet($original->transaction_type, (float) $original->amount)];
            $variations[$compte] = ($variations[$compte] ?? 0) + $this->effet($request->type, (float) $request->montant);
            $this->tresorerie()->refuserDecouvert($comptes, $variations, [
                $ancienCompte => 'Solde insuffisant pour cette modification',
                $compte       => 'Solde insuffisant pour cette modification',
            ]);

            // 1. Annule l'effet de l'ancienne opération sur l'ancien compte
            if ($original->transaction_type === 'E') {
                DB::table('compte')->where('id_compte', $original->account)->decrement('montant', $original->amount);
            } else {
                DB::table('compte')->where('id_compte', $original->account)->increment('montant', $original->amount);
            }

            // 2. Applique l'effet de la nouvelle opération (compte éventuellement différent)
            if ($request->type === 'E') {
                DB::table('compte')->where('id_compte', $request->compte)->increment('montant', $request->montant);
            } else {
                DB::table('compte')->where('id_compte', $request->compte)->decrement('montant', $request->montant);
            }

            // 3. Met à jour la ligne de transaction
            DB::table('transaction')->where('id_transaction', $id)->update([
                'transaction_type' => $request->type,
                'amount'           => $request->montant,
                'reson'            => $request->raison,
                'account'          => $request->compte,
            ]);

            return $this->ok('Opération mise à jour avec succès');
        }, 3));
    }

    // La suppression annule d'abord l'effet de l'opération sur le compte, puis
    // supprime la ligne, dans une transaction. Refusée si elle rendait le
    // compte négatif : supprimer un dépôt dont l'argent a déjà été dépensé.
    public function destroy($id)
    {
        return $this->proteger('Erreur lors de la suppression', fn () => DB::transaction(function () use ($id) {
            $original = DB::table('transaction')->where('id_transaction', $id)->lockForUpdate()->first();
            if (!$original) {
                return $this->err('Opération non trouvée', 404);
            }
            if ($refus = $this->refusSiEcritureProtegee($original)) return $refus;

            $compte  = (int) $original->account;
            $comptes = $this->tresorerie()->verrouillerComptes([$compte]);
            $this->tresorerie()->refuserDecouvert(
                $comptes,
                [$compte => -$this->effet($original->transaction_type, (float) $original->amount)],
                [$compte => 'Solde insuffisant : supprimer cette opération rendrait le compte négatif.']
            );

            // Annule l'effet de l'opération sur le solde du compte :
            // un dépôt (E) avait augmenté le solde -> on le décrémente,
            // un retrait (S) avait diminué le solde -> on l'incrémente.
            if ($original->transaction_type === 'E') {
                DB::table('compte')->where('id_compte', $original->account)->decrement('montant', $original->amount);
            } else {
                DB::table('compte')->where('id_compte', $original->account)->increment('montant', $original->amount);
            }

            DB::table('transaction')->where('id_transaction', $id)->delete();

            return $this->ok('Supprimé avec succès — le solde du compte a été réajusté');
        }, 3));
    }

    /** Effet d'une opération sur le solde : +montant pour une entrée, -montant pour une sortie. */
    private function effet(string $type, float $montant): float
    {
        return $type === 'E' ? $montant : -$montant;
    }

    private function tresorerie(): TresorerieService
    {
        return app(TresorerieService::class);
    }
}
