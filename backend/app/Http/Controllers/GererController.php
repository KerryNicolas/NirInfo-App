<?php
namespace App\Http\Controllers;

use App\Services\DepenseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GererController extends BaseApiController
{
    // FIX : cet écran modifie et supprime une écriture du journal par son
    // numéro. Avec le suivi des dépenses, une écriture rattachée à un achat ou
    // à une charge (paiement, écriture inverse, sortie de l'ancien système) ne
    // doit plus pouvoir l'être ici : elle ne se corrige que par l'annulation
    // du paiement, qui laisse une trace. Sans effet si le suivi est désactivé.
    private function refusSiEcritureDeDepense(object $transaction)
    {
        if (DepenseService::actif() && app(DepenseService::class)->ecritureProtegee($transaction)) {
            return $this->err("Cette écriture est rattachée à une dépense : elle ne peut être ni modifiée ni supprimée ici. Annulez le paiement depuis la dépense.", 422);
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
    private const MOTIFS_RESERVES = ['inscription', 'recouvrement', 'achat', 'charge', 'prestation', 'recouvrement_prestation', 'certificat'];
    private const PREFIXES_RESERVES = [
        'certification ', 'correction inscription #', 'correction recouvrement #',
        'suppression inscription #', 'suppression recouvrement #',
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
        $exclus = ['inscription', 'recouvrement', 'charge', 'achat', 'prestation', 'recouvrement_prestation', 'certificat'];

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

    public function store(Request $request)
    {
        $request->validate([
            'compte'  => 'required|integer|exists:compte,id_compte',
            'type'    => 'required|in:E,S',
            'montant' => 'required|numeric|min:1',
            'raison'  => 'required|string|max:255',
        ]);

        if ($refus = $this->refusSiMotifReserve($request->raison)) return $refus;

        // Empêche un retrait supérieur au solde disponible
        if ($request->type === 'S') {
            $solde = (float) DB::table('compte')->where('id_compte', $request->compte)->value('montant');
            if ($request->montant > $solde) {
                return $this->err('Solde insuffisant pour ce retrait', 422);
            }
        }

        DB::beginTransaction();
        try {
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

            DB::commit();
            return $this->ok('Opération enregistrée avec succès', [], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de l\'enregistrement', 'error' => $e->getMessage()], 500);
        }
    }

    // ─── Modification — annule l'effet de l'ancienne opération puis applique la nouvelle ──
    public function update(Request $request, $id)
    {
        $request->validate([
            'compte'  => 'required|integer|exists:compte,id_compte',
            'type'    => 'required|in:E,S',
            'montant' => 'required|numeric|min:1',
            'raison'  => 'required|string|max:255',
        ]);

        if ($refus = $this->refusSiMotifReserve($request->raison)) return $refus;

        $original = DB::table('transaction')->where('id_transaction', $id)->first();
        if (!$original) {
            return $this->err('Opération non trouvée', 404);
        }
        if ($refus = $this->refusSiEcritureDeDepense($original)) return $refus;

        DB::beginTransaction();
        try {
            // 1. Annule l'effet de l'ancienne opération sur l'ancien compte
            if ($original->transaction_type === 'E') {
                DB::table('compte')->where('id_compte', $original->account)->decrement('montant', $original->amount);
            } else {
                DB::table('compte')->where('id_compte', $original->account)->increment('montant', $original->amount);
            }

            // 2. Vérifie le solde suffisant si la nouvelle opération est un retrait
            if ($request->type === 'S') {
                $soldeApresAnnulation = (float) DB::table('compte')->where('id_compte', $request->compte)->value('montant');
                if ($request->montant > $soldeApresAnnulation) {
                    DB::rollBack();
                    return $this->err('Solde insuffisant pour cette modification', 422);
                }
            }

            // 3. Applique l'effet de la nouvelle opération (compte éventuellement différent)
            if ($request->type === 'E') {
                DB::table('compte')->where('id_compte', $request->compte)->increment('montant', $request->montant);
            } else {
                DB::table('compte')->where('id_compte', $request->compte)->decrement('montant', $request->montant);
            }

            // 4. Met à jour la ligne de transaction
            DB::table('transaction')->where('id_transaction', $id)->update([
                'transaction_type' => $request->type,
                'amount'           => $request->montant,
                'reson'            => $request->raison,
                'account'          => $request->compte,
            ]);

            DB::commit();
            return $this->ok('Opération mise à jour avec succès');

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la mise à jour', 'error' => $e->getMessage()], 500);
        }
    }

    // FIX : la suppression annulait la transaction sans jamais réajuster le
    // solde du compte concerné — un dépôt supprimé laissait le montant
    // "gagné" dans le solde, un retrait supprimé laissait le solde amputé
    // pour rien. On applique ici le même principe que update() : on annule
    // d'abord l'effet de l'opération sur le compte, puis seulement on
    // supprime la ligne, le tout dans une transaction DB pour rester
    // cohérent en cas d'erreur.
    public function destroy($id)
    {
        $original = DB::table('transaction')->where('id_transaction', $id)->first();
        if (!$original) {
            return $this->err('Opération non trouvée', 404);
        }
        if ($refus = $this->refusSiEcritureDeDepense($original)) return $refus;

        DB::beginTransaction();
        try {
            // Annule l'effet de l'opération sur le solde du compte :
            // un dépôt (E) avait augmenté le solde -> on le décrémente,
            // un retrait (S) avait diminué le solde -> on l'incrémente.
            if ($original->transaction_type === 'E') {
                DB::table('compte')->where('id_compte', $original->account)->decrement('montant', $original->amount);
            } else {
                DB::table('compte')->where('id_compte', $original->account)->increment('montant', $original->amount);
            }

            DB::table('transaction')->where('id_transaction', $id)->delete();

            DB::commit();
            return $this->ok('Supprimé avec succès — le solde du compte a été réajusté');

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la suppression', 'error' => $e->getMessage()], 500);
        }
    }
}