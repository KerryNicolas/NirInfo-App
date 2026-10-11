<?php

namespace App\Services;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Service de trésorerie — point unique d'écriture « solde + journal ».
 *
 * Reprend à l'identique la logique qui se trouvait dans
 * BaseApiController::ajusterSoldeCompte() (mêmes tables, mêmes champs, même
 * ordre), avec deux ajouts :
 *  - le compte est verrouillé le temps de l'opération : deux mouvements
 *    simultanés sur le même compte passent l'un après l'autre ;
 *  - le numéro EXACT de l'écriture créée est renvoyé (jamais « le dernier
 *    numéro de la table », qui peut appartenir à un autre utilisateur).
 */
class TresorerieService
{
    /** Colonnes de traçabilité du journal (migration 2026_10_11_000002). */
    private const TRACE = ['type_operation', 'origine_table', 'origine_id', 'transaction_annulee_id', 'reference_virement', 'cree_par'];

    /** Numéro lu pour les paiements de l'ancien système, dont le compte est un libellé. */
    private const COMPTE_HISTORIQUE = 0;

    /**
     * Un compte est « utilisé » dès qu'une écriture du journal ou un virement
     * le cite. Ne lit que des colonnes d'origine : utilisable sur toute base,
     * migrée ou non. (Les virements ne sont pas écrits au journal : un compte
     * peut donc être utilisé par un virement avec un journal vide.)
     */
    public function compteUtilise(int $idCompte): bool
    {
        return DB::table('transaction')->where('account', $idCompte)->exists()
            || DB::table('transfer')->where('starting_account', $idCompte)->orWhere('destination_account', $idCompte)->exists();
    }

    /**
     * Enregistre un mouvement : solde du compte, journal `transaction` et
     * `gestion_compte`, dans une seule transaction SQL (tout ou rien).
     *
     * @param  int     $idCompte
     * @param  float   $montant
     * @param  string  $sens     'E' (entrée, +) ou 'S' (sortie, -)
     * @param  string  $raison   texte journalisé dans transaction.reson
     * @param  array   $trace    FACULTATIF — traçabilité de l'écriture (colonnes
     *                           TRACE ci-dessous). Sans lui, l'écriture est
     *                           strictement celle d'avant : les appels existants
     *                           (inscriptions, recouvrements) ne le passent pas,
     *                           et aucune des nouvelles colonnes n'est touchée.
     * @return int     id_transaction de l'écriture créée
     */
    public function mouvement(int $idCompte, float $montant, string $sens, string $raison, array $trace = []): int
    {
        return DB::transaction(function () use ($idCompte, $montant, $sens, $raison, $trace) {
            // Verrou sur la ligne du compte jusqu'à la fin de la transaction.
            $compte = DB::table('compte')->where('id_compte', $idCompte)->lockForUpdate()->first();

            // FIX : on n'écrit plus au journal sur un compte qui n'existe pas
            // (ou qui vient d'être supprimé) — l'écriture resterait sans compte.
            // SEULE EXCEPTION, le compte 0 : les paiements de l'ancien système
            // portent un libellé (« inscription », « Mobile Money »…) au lieu
            // d'un numéro, lu comme 0 ; ils doivent rester modifiables, et
            // leur écriture se journalise sur le compte 0 comme avant.
            // Lu sur la ligne VERROUILLÉE : une suppression concurrente du
            // compte est donc vue ici.
            if (!$compte && $idCompte !== self::COMPTE_HISTORIQUE) {
                throw new HttpException(422, "Le compte n° {$idCompte} n'existe pas ou vient d'être supprimé : opération refusée.");
            }

            if ($sens === 'E') {
                DB::table('compte')->where('id_compte', $idCompte)->increment('montant', $montant);
            } else {
                DB::table('compte')->where('id_compte', $idCompte)->decrement('montant', $montant);
            }

            $ecriture = [
                'transaction_type' => $sens,
                'amount'           => $montant,
                'reson'            => $raison,
                'account'          => $idCompte,
                'date_transaction' => now()->toDateString(),
            ];

            // Traçabilité : seules les colonnes prévues sont acceptées, et
            // l'horodatage est posé ici, jamais par l'appelant.
            if ($trace !== []) {
                $ecriture += array_intersect_key($trace, array_flip(self::TRACE)) + ['cree_le' => now()];
            }

            $idTransaction = DB::table('transaction')->insertGetId($ecriture);

            DB::table('gestion_compte')->insert([
                'id_compte'      => $idCompte,
                'type'           => $sens,
                'montant'        => $montant,
                'date_gestion'   => now()->toDateString(),
                'id_transaction' => $idTransaction,
            ]);

            return (int) $idTransaction;
        });
    }

    /* ═══════════════════════════════════════════
     *  VERROUS ET CONTRÔLES DE SOLDE
     *  Utilisés par les virements et par les opérations de la Gestion.
     *  Ne lisent que des colonnes d'origine : TOUJOURS actifs, sur toute base.
     *  À appeler DANS une transaction SQL.
     * ═══════════════════════════════════════════ */

    /**
     * Verrouille plusieurs comptes et renvoie [numéro => ligne, ou null si le
     * compte n'existe pas]. Toujours dans l'ordre CROISSANT des numéros : deux
     * opérations qui visent les mêmes comptes en sens inverse (virement A→B et
     * virement B→A en même temps) les demandent ainsi dans le même ordre, et
     * ne peuvent pas se bloquer mutuellement.
     */
    public function verrouillerComptes(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        sort($ids);

        $comptes = [];
        foreach ($ids as $id) {
            $comptes[$id] = DB::table('compte')->where('id_compte', $id)->lockForUpdate()->first();
        }

        return $comptes;
    }

    /** Refuse l'opération si l'un de ces comptes (déjà verrouillés) n'existe pas. */
    public function exigerComptes(array $comptes, array $ids): void
    {
        foreach ($ids as $id) {
            if (empty($comptes[(int) $id])) {
                throw new HttpException(422, "Le compte n° {$id} n'existe pas ou vient d'être supprimé : opération refusée.");
            }
        }
    }

    /**
     * Refuse l'opération si elle rendait un compte négatif.
     *
     * @param array $comptes     comptes verrouillés (voir verrouillerComptes) : le solde lu est le solde réel
     * @param array $variations  [numéro de compte => variation NETTE de l'opération entière]
     * @param array $messages    [numéro de compte => message], pour garder un libellé déjà connu des écrans
     *
     * On raisonne sur l'effet net : modifier un virement annule l'ancien puis
     * applique le nouveau, et seul le solde final compte. Une opération qui
     * AMÉLIORE un solde déjà négatif n'est pas refusée.
     */
    public function refuserDecouvert(array $comptes, array $variations, array $messages = []): void
    {
        foreach ($variations as $id => $variation) {
            $compte = $comptes[(int) $id] ?? null;
            if (!$compte) {
                continue;
            }

            $avant = round((float) $compte->montant, 2);
            $apres = round($avant + $variation, 2);

            if ($apres < 0 && $apres < $avant) {
                throw new HttpException(422, $messages[(int) $id] ?? sprintf(
                    'Solde insuffisant sur %s : %s Ar disponibles, il manquerait %s Ar.',
                    $compte->libelle, number_format($avant, 0, ',', ' '), number_format(-$apres, 0, ',', ' ')
                ));
            }
        }
    }

    /* ═══════════════════════════════════════════
     *  VIREMENTS ENTRE COMPTES
     *
     *  $journal = false (suivi désactivé) : comportement d'origine — la ligne
     *  `transfer` et les deux soldes, sans écriture au journal — mais sous
     *  verrou, avec contrôle du solde et de l'existence des comptes.
     *
     *  $journal = true (suivi activé, base migrée) : chaque virement écrit DEUX
     *  écritures liées au journal — une sortie du compte de départ, une entrée
     *  sur le compte d'arrivée — de même montant et de même référence. Les
     *  modifier ou les supprimer n'efface rien : les deux écritures d'origine
     *  restent, et deux écritures inverses les compensent.
     *
     *  Un virement n'est ni une recette ni une dépense : ses écritures portent
     *  le type « virement » (ou « annulation_virement »).
     * ═══════════════════════════════════════════ */

    /** Motif des écritures de virement (masqué et réservé dans la Gestion). */
    public const MOTIF_VIREMENT = 'virement';

    /** @return int numéro du virement créé */
    public function creerVirement(int $de, int $vers, float $montant, ?int $userId, bool $journal): int
    {
        return DB::transaction(function () use ($de, $vers, $montant, $userId, $journal) {
            $this->exigerVirementValide($de, $vers, $montant);

            $comptes = $this->verrouillerComptes([$de, $vers]);
            $this->exigerComptes($comptes, [$de, $vers]);
            $this->refuserDecouvert($comptes, [$de => -$montant], [$de => 'Solde insuffisant sur le compte de départ']);

            $ligne = ['starting_account' => $de, 'destination_account' => $vers, 'amount' => $montant];
            if ($journal) {
                $ligne += ['date_transfer' => now(), 'cree_par' => $userId];
            }
            $id = (int) DB::table('transfer')->insertGetId($ligne, 'id_transfer');

            if ($journal) {
                [$debit, $credit] = $this->journaliserVirement($id, $de, $vers, $montant, $userId);
                DB::table('transfer')->where('id_transfer', $id)->update(['id_transaction_debit' => $debit, 'id_transaction_credit' => $credit]);
            } else {
                DB::table('compte')->where('id_compte', $de)->decrement('montant', $montant);
                DB::table('compte')->where('id_compte', $vers)->increment('montant', $montant);
            }

            return $id;
        }, 3);
    }

    public function modifierVirement(int $id, int $de, int $vers, float $montant, ?int $userId, bool $journal): void
    {
        DB::transaction(function () use ($id, $de, $vers, $montant, $userId, $journal) {
            $virement = $this->verrouillerVirement($id);
            $this->exigerVirementValide($de, $vers, $montant);
            $this->refuserSelonLeMode($virement, $journal);

            $ancienDe   = (int) $virement->starting_account;
            $ancienVers = (int) $virement->destination_account;
            $ancien     = (float) $virement->amount;

            $comptes = $this->verrouillerComptes([$ancienDe, $ancienVers, $de, $vers]);
            // Les nouveaux comptes doivent exister ; les anciens aussi quand on écrit au journal.
            $this->exigerComptes($comptes, $journal ? [$ancienDe, $ancienVers, $de, $vers] : [$de, $vers]);

            // Effet NET de « annuler l'ancien virement, appliquer le nouveau ».
            $variations = [];
            foreach ([[$ancienDe, $ancien], [$ancienVers, -$ancien], [$de, -$montant], [$vers, $montant]] as [$compte, $v]) {
                $variations[$compte] = ($variations[$compte] ?? 0) + $v;
            }
            $this->refuserDecouvert($comptes, $variations, [$de => 'Solde insuffisant sur le compte de départ']);

            $valeurs = ['starting_account' => $de, 'destination_account' => $vers, 'amount' => $montant];

            if ($journal) {
                $this->compenserVirement($virement, $userId);
                [$debit, $credit] = $this->journaliserVirement($id, $de, $vers, $montant, $userId);
                $valeurs += ['id_transaction_debit' => $debit, 'id_transaction_credit' => $credit];
            } else {
                DB::table('compte')->where('id_compte', $ancienDe)->increment('montant', $ancien);
                DB::table('compte')->where('id_compte', $ancienVers)->decrement('montant', $ancien);
                DB::table('compte')->where('id_compte', $de)->decrement('montant', $montant);
                DB::table('compte')->where('id_compte', $vers)->increment('montant', $montant);
            }

            DB::table('transfer')->where('id_transfer', $id)->update($valeurs);
        }, 3);
    }

    /**
     * Supprime la LIGNE du virement et rétablit les soldes. Avec le journal,
     * les deux écritures d'origine sont conservées et deux écritures inverses
     * sont ajoutées : les quatre restent retrouvables par leur référence
     * commune et par le numéro du virement (origine_id), même sans la ligne.
     */
    public function supprimerVirement(int $id, ?int $userId, bool $journal): void
    {
        DB::transaction(function () use ($id, $userId, $journal) {
            $virement = $this->verrouillerVirement($id);
            $this->refuserSelonLeMode($virement, $journal);

            $de      = (int) $virement->starting_account;
            $vers    = (int) $virement->destination_account;
            $montant = (float) $virement->amount;

            $comptes = $this->verrouillerComptes([$de, $vers]);
            if ($journal) {
                $this->exigerComptes($comptes, [$de, $vers]);
            }
            // Annuler un virement reprend l'argent sur le compte d'arrivée : refusé s'il a déjà été dépensé.
            $this->refuserDecouvert($comptes, [$de => $montant, $vers => -$montant]);

            if ($journal) {
                $this->compenserVirement($virement, $userId);
            } else {
                DB::table('compte')->where('id_compte', $de)->increment('montant', $montant);
                DB::table('compte')->where('id_compte', $vers)->decrement('montant', $montant);
            }

            DB::table('transfer')->where('id_transfer', $id)->delete();
        }, 3);
    }

    private function verrouillerVirement(int $id): object
    {
        $virement = DB::table('transfer')->where('id_transfer', $id)->lockForUpdate()->first();
        if (!$virement) {
            throw new HttpException(404, 'Virement non trouvé');
        }

        return $virement;
    }

    private function exigerVirementValide(int $de, int $vers, float $montant): void
    {
        if ($de === $vers) {
            throw new HttpException(422, 'Le compte de départ et le compte de destination doivent être différents.');
        }
        // La table des virements et le journal sont en ariary entiers.
        if ($montant < 1 || floor($montant) != $montant) {
            throw new HttpException(422, "Le montant d'un virement doit être un nombre entier d'ariary, supérieur à 0.");
        }
    }

    /**
     * Un virement « journalisé » a ses deux numéros d'écriture renseignés (par
     * ce service, à sa création). Un virement « historique » ne les a pas : on
     * ne lui invente aucune écriture.
     *  - suivi activé  : un virement historique est verrouillé ;
     *  - suivi désactivé : un virement journalisé est verrouillé, sinon ses
     *    soldes changeraient sans écriture au journal.
     * Lu sur la ligne entière, sans nommer de colonne : compatible avec une
     * base non migrée, où ces deux colonnes n'existent pas.
     */
    private function refuserSelonLeMode(object $virement, bool $journal): void
    {
        $journalise = !empty($virement->id_transaction_debit ?? null) && !empty($virement->id_transaction_credit ?? null);

        if ($journal && !$journalise) {
            throw new HttpException(422, "Ce virement provient de l'ancien système : il ne peut être ni modifié ni supprimé.");
        }
        if (!$journal && $journalise) {
            throw new HttpException(422, "Ce virement est inscrit au journal : il ne peut être modifié ou supprimé que lorsque le suivi de trésorerie est activé.");
        }
    }

    /** Écrit la sortie et l'entrée d'un virement. @return int[] [numéro de la sortie, numéro de l'entrée] */
    private function journaliserVirement(int $id, int $de, int $vers, float $montant, ?int $userId): array
    {
        // Référence propre à CE mouvement, indépendante de la table `transfer` :
        // elle reste unique et lisible même si la ligne du virement est supprimée.
        $trace = [
            'type_operation'     => 'virement',
            'origine_table'      => 'transfer',
            'origine_id'         => $id,
            'reference_virement' => 'VIR-' . Str::ulid(),
            'cree_par'           => $userId,
        ];

        return [
            $this->mouvement($de, $montant, 'S', self::MOTIF_VIREMENT, $trace),
            $this->mouvement($vers, $montant, 'E', self::MOTIF_VIREMENT, $trace),
        ];
    }

    /**
     * Compense les deux écritures d'un virement journalisé, après avoir
     * vérifié qu'elles sont bien SES écritures. L'index unique sur
     * transaction_annulee_id empêche d'annuler deux fois une écriture ; il ne
     * dit rien de la cohérence du virement lui-même : c'est ce contrôle-ci.
     */
    private function compenserVirement(object $virement, ?int $userId): void
    {
        $debit  = DB::table('transaction')->where('id_transaction', $virement->id_transaction_debit)->lockForUpdate()->first();
        $credit = DB::table('transaction')->where('id_transaction', $virement->id_transaction_credit)->lockForUpdate()->first();

        $coherent = $debit && $credit
            && $debit->transaction_type === 'S' && $credit->transaction_type === 'E'
            && (int) $debit->account === (int) $virement->starting_account
            && (int) $credit->account === (int) $virement->destination_account
            && (int) $debit->account !== (int) $credit->account
            && (float) $debit->amount == (float) $virement->amount
            && (float) $credit->amount == (float) $virement->amount
            && !empty($debit->reference_virement) && $debit->reference_virement === $credit->reference_virement
            && $debit->origine_table === 'transfer' && $credit->origine_table === 'transfer'
            && (int) $debit->origine_id === (int) $virement->id_transfer
            && (int) $credit->origine_id === (int) $virement->id_transfer
            && $debit->transaction_annulee_id === null && $credit->transaction_annulee_id === null;

        if (!$coherent) {
            throw new HttpException(422, 'Les écritures de ce virement sont introuvables ou incohérentes : opération refusée.');
        }
        if (DB::table('transaction')->whereIn('transaction_annulee_id', [$debit->id_transaction, $credit->id_transaction])->exists()) {
            throw new HttpException(422, 'Les écritures de ce virement ont déjà été annulées.');
        }

        $trace = [
            'type_operation'     => 'annulation_virement',
            'origine_table'      => 'transfer',
            'origine_id'         => (int) $virement->id_transfer,
            'reference_virement' => $debit->reference_virement, // même référence que le mouvement annulé
            'cree_par'           => $userId,
        ];

        try {
            $this->mouvement((int) $debit->account, (float) $debit->amount, 'E', self::MOTIF_VIREMENT, $trace + ['transaction_annulee_id' => (int) $debit->id_transaction]);
            $this->mouvement((int) $credit->account, (float) $credit->amount, 'S', self::MOTIF_VIREMENT, $trace + ['transaction_annulee_id' => (int) $credit->id_transaction]);
        } catch (QueryException $e) {
            if (str_contains($e->getMessage(), '1062')) {
                throw new HttpException(422, 'Les écritures de ce virement ont déjà été annulées.');
            }
            throw $e;
        }
    }
}
