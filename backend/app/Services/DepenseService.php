<?php

namespace App\Services;

use Illuminate\Database\QueryException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Suivi des dépenses (achats et charges) : statuts, validation, paiement,
 * annulation et historique des actions.
 *
 *   enregistree ──valider──> validee ──payer──> payee
 *        │                     │  ^                │
 *        └──────annuler────────┘  └─annuler le paiement
 *                 v
 *              annulee (définitif)
 *
 * Règles tenues ici, pour tous les appelants :
 *  - chaque action se déroule dans UNE transaction SQL : statut, écriture au
 *    journal, solde du compte et événement réussissent ensemble ou sont
 *    annulés ensemble ;
 *  - la ligne de la dépense est verrouillée d'abord, et son statut est lu
 *    SOUS ce verrou : deux demandes simultanées passent l'une après l'autre,
 *    la seconde trouve le nouveau statut et est refusée ;
 *  - les mouvements d'argent passent tous par TresorerieService ; ce service
 *    crée lui-même l'écriture, il n'accepte jamais un numéro venu d'ailleurs ;
 *  - une écriture n'est jamais modifiée ni supprimée : annuler un paiement
 *    ajoute une écriture inverse qui porte le numéro de celle qu'elle annule ;
 *  - les dépenses de l'ancien système (colonne ancien_systeme) sont
 *    verrouillées : ni modification, ni suppression, ni annulation.
 *
 * Les refus sont des HttpException : Laravel les rend en JSON
 * {"message": "..."} avec le bon code HTTP, et la transaction est annulée.
 */
class DepenseService
{
    public const ENREGISTREE = 'enregistree';
    public const VALIDEE     = 'validee';
    public const PAYEE       = 'payee';
    public const ANNULEE     = 'annulee';

    private const TYPES = [
        'achat'  => ['table' => 'achat',  'cle' => 'id_achat'],
        'charge' => ['table' => 'charge', 'cle' => 'id_charge'],
    ];

    private const LIBELLES = [
        self::ENREGISTREE => 'enregistrée',
        self::VALIDEE     => 'validée',
        self::PAYEE       => 'payée',
        self::ANNULEE     => 'annulée',
    ];

    /** Attente maximale d'un verrou, en secondes (le serveur attend 600 s par défaut). */
    private const ATTENTE_VERROU = 10;

    public function __construct(private TresorerieService $tresorerie)
    {
    }

    /** Le suivi des dépenses est-il activé sur cette installation ? (config/depenses.php) */
    public static function actif(): bool
    {
        return (bool) config('depenses.workflow');
    }

    /* ═══════════════════════════════════════════
     *  ACTIONS
     * ═══════════════════════════════════════════ */

    /** enregistree -> validee. Aucun mouvement d'argent. */
    public function valider(string $type, int $id, int $userId): object
    {
        return $this->operation(function () use ($type, $id, $userId) {
            $d = $this->verrouiller($type, $id);
            $this->refuserAncienSysteme($d);
            $this->exigerStatut($d, [self::ENREGISTREE], 'elle ne peut pas être validée');

            if ((float) $d->montant <= 0) {
                throw new HttpException(422, 'Le montant doit être supérieur à 0 pour valider cette dépense.');
            }
            // Refusé dès la validation : le journal est en ariary entiers, une
            // dépense à décimales resterait sinon bloquée à « validée ».
            if (floor((float) $d->montant) != (float) $d->montant) {
                throw new HttpException(422, "Le montant doit être un nombre entier d'ariary pour être validé.");
            }

            $this->modifier($type, $id, [
                'statut'          => self::VALIDEE,
                'valide_par'      => $userId,
                'date_validation' => now(),
            ]);
            $this->evenement($type, $id, 'validation', $d->statut, self::VALIDEE, $userId, ['montant' => $d->montant]);

            return $this->lire($type, $id);
        });
    }

    /** validee -> payee. UNE sortie au journal, le compte est débité. */
    public function payer(string $type, int $id, int $idCompte, int $userId): object
    {
        return $this->operation(function () use ($type, $id, $idCompte, $userId) {
            $d = $this->verrouiller($type, $id);
            $this->refuserAncienSysteme($d);
            $this->exigerStatut($d, [self::VALIDEE], 'elle ne peut pas être payée');

            if ((int) $d->id_transaction !== 0) {
                throw new HttpException(422, 'Cette dépense est déjà rattachée à une écriture du journal.');
            }

            $montant = (float) $d->montant;
            if ($montant <= 0) {
                throw new HttpException(422, 'Le montant doit être supérieur à 0 pour être payé.');
            }
            if (floor($montant) != $montant) {
                throw new HttpException(422, "Le montant doit être un nombre entier d'ariary pour être payé.");
            }

            // Le solde est lu sur la ligne VERROUILLÉE du compte.
            $compte = DB::table('compte')->where('id_compte', $idCompte)->lockForUpdate()->first();
            if (!$compte) {
                throw new HttpException(422, "Le compte choisi n'existe pas.");
            }
            if ((float) $compte->montant < $montant) {
                throw new HttpException(422, sprintf(
                    'Solde insuffisant sur %s : %s Ar disponibles, %s Ar demandés.',
                    $compte->libelle, $this->ar((float) $compte->montant), $this->ar($montant)
                ));
            }

            // Même motif que l'ancien système (« achat » / « charge »).
            $idTransaction = $this->tresorerie->mouvement($idCompte, $montant, 'S', $type, [
                'type_operation' => $type,
                'origine_table'  => self::TYPES[$type]['table'],
                'origine_id'     => $id,
                'cree_par'       => $userId,
            ]);

            $this->modifier($type, $id, [
                'statut'         => self::PAYEE,
                'id_compte'      => $idCompte,
                'id_transaction' => $idTransaction,
                'paye_par'       => $userId,
                'date_paiement'  => now(),
            ]);
            $this->evenement($type, $id, 'paiement', $d->statut, self::PAYEE, $userId, [
                'id_compte' => $idCompte, 'montant' => $montant, 'id_transaction' => $idTransaction,
            ]);

            return $this->lire($type, $id);
        });
    }

    /**
     * payee -> validee. L'écriture d'origine est conservée telle quelle ; une
     * écriture inverse (même compte, même montant) est ajoutée et le compte
     * est recrédité. La dépense peut ensuite être payée à nouveau.
     */
    public function annulerPaiement(string $type, int $id, string $motif, int $userId): object
    {
        return $this->operation(function () use ($type, $id, $motif, $userId) {
            $d = $this->verrouiller($type, $id);
            $this->refuserAncienSysteme($d);
            $this->exigerStatut($d, [self::PAYEE], 'son paiement ne peut pas être annulé');
            $motif = $this->exigerMotif($motif);

            $origine = DB::table('transaction')->where('id_transaction', $d->id_transaction)->lockForUpdate()->first();
            if (
                !$origine
                || $origine->transaction_type !== 'S'
                || $origine->origine_table !== self::TYPES[$type]['table']
                || (int) $origine->origine_id !== $id
            ) {
                throw new HttpException(422, "L'écriture de paiement de cette dépense est introuvable ou incohérente : annulation impossible.");
            }

            DB::table('compte')->where('id_compte', $origine->account)->lockForUpdate()->first();

            try {
                $idInverse = $this->tresorerie->mouvement((int) $origine->account, (float) $origine->amount, 'E', $type, [
                    'type_operation'         => 'annulation_paiement',
                    'origine_table'          => self::TYPES[$type]['table'],
                    'origine_id'             => $id,
                    'transaction_annulee_id' => (int) $origine->id_transaction,
                    'cree_par'               => $userId,
                ]);
            } catch (QueryException $e) {
                // Dernière barrière : l'index unique sur transaction_annulee_id.
                if (str_contains($e->getMessage(), '1062')) {
                    throw new HttpException(422, 'Ce paiement a déjà été annulé.');
                }
                throw $e;
            }

            $this->modifier($type, $id, [
                'statut'         => self::VALIDEE,
                'id_transaction' => 0,
                'id_compte'      => null,
                'paye_par'       => null,
                'date_paiement'  => null,
            ]);
            $this->evenement($type, $id, 'annulation_paiement', $d->statut, self::VALIDEE, $userId, [
                'id_compte' => (int) $origine->account, 'montant' => (float) $origine->amount,
                'id_transaction' => $idInverse, 'motif' => $motif,
            ]);

            return $this->lire($type, $id);
        });
    }

    /**
     * enregistree | validee -> annulee (définitif). Aucun mouvement d'argent.
     * Permis à l'administrateur, ou à l'utilisateur qui a saisi la dépense.
     */
    public function annuler(string $type, int $id, string $motif, int $userId, bool $estAdmin): object
    {
        return $this->operation(function () use ($type, $id, $motif, $userId, $estAdmin) {
            $d = $this->verrouiller($type, $id);
            $this->refuserAncienSysteme($d);

            // L'auteur de la saisie est l'identifiant utilisateur gardé dans matricule_s.
            if (!$estAdmin && (string) $d->matricule_s !== (string) $userId) {
                throw new HttpException(403, "Seul l'administrateur ou l'auteur de la saisie peut annuler cette dépense.");
            }
            if ($d->statut === self::PAYEE) {
                throw new HttpException(422, "Cette dépense est payée : annulez d'abord son paiement.");
            }
            $this->exigerStatut($d, [self::ENREGISTREE, self::VALIDEE], 'elle ne peut pas être annulée');
            $motif = $this->exigerMotif($motif);

            $this->modifier($type, $id, [
                'statut'           => self::ANNULEE,
                'annule_par'       => $userId,
                'date_annulation'  => now(),
                'motif_annulation' => $motif,
            ]);
            $this->evenement($type, $id, 'annulation', $d->statut, self::ANNULEE, $userId, ['montant' => $d->montant, 'motif' => $motif]);

            return $this->lire($type, $id);
        });
    }

    /* ═══════════════════════════════════════════
     *  CONTRÔLES AUTOUR DES ÉCRANS EXISTANTS
     *  (saisie, modification, suppression — LogistiqueController)
     *  À appeler DANS la transaction du contrôleur.
     * ═══════════════════════════════════════════ */

    /** Trace la saisie d'une nouvelle dépense. */
    public function apresSaisie(string $type, int $id, float $montant, int $userId): void
    {
        $this->evenement($type, $id, 'saisie', null, self::ENREGISTREE, $userId, ['montant' => $montant]);
    }

    /**
     * Avant modification d'une dépense.
     *
     * 1. AUTORISATION — toujours, que le suivi soit activé ou non : seuls
     *    l'administrateur et l'auteur de la saisie peuvent modifier une
     *    dépense. Ne lit que des colonnes d'origine (matricule_s contient
     *    l'identifiant de l'utilisateur qui a saisi). Une dépense de l'ancien
     *    système n'a pas d'auteur exploitable : seul l'administrateur y accède.
     *
     * 2. SUIVI — seulement s'il est activé : refuse une dépense de l'ancien
     *    système, payée ou annulée ; trace chaque modification avec l'ancien
     *    et le nouveau montant ; ramène une dépense validée à « enregistree »
     *    si son montant change (elle devra être validée à nouveau).
     */
    public function avantModification(string $type, int $id, float $nouveauMontant, int $userId, bool $estAdmin): void
    {
        $d = DB::table(self::TYPES[$type]['table'])->where(self::TYPES[$type]['cle'], $id)->lockForUpdate()->first();
        if (!$d) {
            return; // ligne inexistante : comportement d'avant conservé
        }

        if (!$estAdmin && (string) $d->matricule_s !== (string) $userId) {
            throw new HttpException(403, "Seul l'administrateur ou l'auteur de la saisie peut modifier cette dépense.");
        }

        if (!self::actif()) {
            return;
        }

        $this->refuserAncienSysteme($d);
        $this->exigerStatut($d, [self::ENREGISTREE, self::VALIDEE], 'elle ne peut pas être modifiée');

        // Montants comparés à 2 décimales (la précision de la colonne) : un
        // écart de calcul en virgule flottante n'est pas un changement.
        $ancien  = round((float) $d->montant, 2);
        $nouveau = round($nouveauMontant, 2);
        $trace   = sprintf('Ancien montant : %s Ar', $this->ar2($ancien));

        if ($d->statut === self::VALIDEE && $ancien != $nouveau) {
            $this->modifier($type, $id, ['statut' => self::ENREGISTREE, 'valide_par' => null, 'date_validation' => null]);
            $this->evenement($type, $id, 'retour_enregistree', self::VALIDEE, self::ENREGISTREE, $userId, [
                'montant' => $nouveau, 'motif' => 'Montant modifié après validation. ' . $trace,
            ]);

            return;
        }

        // Toute autre modification laisse aussi une trace : qui, quand, et le
        // montant avant / après (identiques si seul le libellé ou la date change).
        $this->evenement($type, $id, 'modification', $d->statut, $d->statut, $userId, [
            'montant' => $nouveau, 'motif' => $trace,
        ]);
    }

    /** Avant suppression : seule une dépense « enregistree » se supprime ; les autres gardent leur trace. */
    public function avantSuppression(string $type, int $id, int $userId): void
    {
        $d = DB::table(self::TYPES[$type]['table'])->where(self::TYPES[$type]['cle'], $id)->lockForUpdate()->first();
        if (!$d) {
            return;
        }

        $this->refuserAncienSysteme($d);
        $this->exigerStatut($d, [self::ENREGISTREE], 'elle ne peut pas être supprimée');
        $this->evenement($type, $id, 'suppression', $d->statut, null, $userId, ['montant' => $d->montant]);
    }

    /* ═══════════════════════════════════════════
     *  PROTECTION DU JOURNAL ET DES COMPTES
     *  (GererController, CompteController)
     * ═══════════════════════════════════════════ */

    /**
     * Une écriture rattachée à une dépense — paiement, écriture inverse, ou
     * sortie d'une dépense de l'ancien système — ne se modifie ni ne se
     * supprime depuis l'onglet Gestion.
     */
    public function ecritureProtegee(object $transaction): bool
    {
        if (($transaction->origine_table ?? null) !== null || ($transaction->transaction_annulee_id ?? null) !== null) {
            return true;
        }

        foreach (self::TYPES as $t) {
            if (DB::table($t['table'])->where('id_transaction', $transaction->id_transaction)->exists()) {
                return true;
            }
        }

        return DB::table('transaction')->where('transaction_annulee_id', $transaction->id_transaction)->exists();
    }

    /**
     * Le compte est-il cité par une dépense ? Complète
     * TresorerieService::compteUtilise() (journal et virements) ; lit une
     * colonne du suivi, donc à n'appeler que si le suivi est activé.
     */
    public function compteUtiliseParDepense(int $idCompte): bool
    {
        return DB::table('achat')->where('id_compte', $idCompte)->exists()
            || DB::table('charge')->where('id_compte', $idCompte)->exists();
    }

    /* ═══════════════════════════════════════════
     *  LECTURE
     * ═══════════════════════════════════════════ */

    public function lire(string $type, int $id): object
    {
        return DB::table(self::TYPES[$type]['table'])->where(self::TYPES[$type]['cle'], $id)->first();
    }

    /** Historique des actions d'une dépense, de la plus ancienne à la plus récente. */
    public function historique(string $type, int $id): Collection
    {
        return DB::table('depense_evenements as e')
            ->leftJoin('users as u', 'u.id', '=', 'e.user_id')
            ->leftJoin('compte as c', 'c.id_compte', '=', 'e.id_compte')
            ->where('e.type_depense', $type)
            ->where('e.id_depense', $id)
            ->orderBy('e.id')
            ->get([
                'e.id', 'e.action', 'e.statut_avant', 'e.statut_apres', 'e.id_compte', 'c.libelle as compte',
                'e.montant', 'e.id_transaction', 'e.motif', 'e.user_id', 'u.name as utilisateur', 'e.created_at',
            ]);
    }

    /**
     * Ajoute une ligne à l'historique des actions. On n'y fait que des ajouts.
     * Écrite dans la transaction en cours : si elle échoue, l'action entière
     * est annulée.
     */
    public function evenement(string $type, int $id, string $action, ?string $avant, ?string $apres, ?int $userId, array $plus = []): void
    {
        DB::table('depense_evenements')->insert([
            'type_depense'   => $type,
            'id_depense'     => $id,
            'action'         => $action,
            'statut_avant'   => $avant,
            'statut_apres'   => $apres,
            'id_compte'      => $plus['id_compte'] ?? null,
            'montant'        => $plus['montant'] ?? null,
            'id_transaction' => $plus['id_transaction'] ?? null,
            'motif'          => $plus['motif'] ?? null,
            'user_id'        => $userId,
            'created_at'     => now(),
        ]);
    }

    /* ═══════════════════════════════════════════
     *  INTERNE
     * ═══════════════════════════════════════════ */

    /** Exécute une action dans une transaction SQL, avec une attente de verrou courte. */
    private function operation(callable $travail): object
    {
        if (!self::actif()) {
            throw new HttpException(409, "Le suivi des dépenses n'est pas activé sur cette installation.");
        }

        try {
            return DB::transaction(function () use ($travail) {
                DB::statement('SET SESSION innodb_lock_wait_timeout = ' . self::ATTENTE_VERROU);

                return $travail();
            }, 3);
        } catch (QueryException $e) {
            // 1205 : le verrou n'a pas été obtenu à temps (une autre action est en cours).
            if (str_contains($e->getMessage(), '1205')) {
                throw new HttpException(409, 'Une autre opération est en cours sur cette dépense. Réessayez dans un instant.');
            }
            throw $e;
        }
    }

    private function verrouiller(string $type, int $id): object
    {
        $d = DB::table(self::TYPES[$type]['table'])->where(self::TYPES[$type]['cle'], $id)->lockForUpdate()->first();
        if (!$d) {
            throw new HttpException(404, 'Dépense introuvable.');
        }

        return $d;
    }

    private function modifier(string $type, int $id, array $valeurs): void
    {
        DB::table(self::TYPES[$type]['table'])->where(self::TYPES[$type]['cle'], $id)->update($valeurs);
    }

    private function refuserAncienSysteme(object $d): void
    {
        if ((int) ($d->ancien_systeme ?? 0) === 1) {
            throw new HttpException(422, "Cette dépense provient de l'ancien système : elle ne peut pas être modifiée.");
        }
    }

    /** @param string $refus  suite du message, ex. « elle ne peut pas être payée » */
    private function exigerStatut(object $d, array $admis, string $refus): void
    {
        if (!in_array($d->statut, $admis, true)) {
            throw new HttpException(422, sprintf(
                'Cette dépense est au statut « %s » : %s.',
                self::LIBELLES[$d->statut] ?? $d->statut, $refus
            ));
        }
    }

    private function exigerMotif(string $motif): string
    {
        $motif = trim($motif);
        if ($motif === '') {
            throw new HttpException(422, 'Le motif est obligatoire.');
        }

        return mb_substr($motif, 0, 255);
    }

    private function ar(float $montant): string
    {
        return number_format($montant, 0, ',', ' ');
    }

    /** Comme ar(), en gardant les centimes s'il y en a (montants saisis avec décimales). */
    private function ar2(float $montant): string
    {
        return floor($montant) == $montant ? $this->ar($montant) : number_format($montant, 2, ',', ' ');
    }
}
