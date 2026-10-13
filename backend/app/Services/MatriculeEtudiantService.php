<?php

namespace App\Services;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

/**
 * Série unique des matricules « NI-0001 ». Elle sert aux étudiants ET aux
 * certificats saisis à la main (personnes sans fiche étudiant).
 *
 * Le dernier numéro attribué est tenu dans la table `sequence_matricule`
 * (une seule ligne, verrouillée le temps de l'attribution). Un numéro n'est
 * jamais donné s'il figure déjà dans l'historique — fiche étudiant, paiement,
 * certificat ou pointage — même quand la fiche correspondante n'existe plus :
 * un nouvel étudiant ne peut donc pas hériter des paiements d'un autre.
 *
 * Ce service ne modifie aucun matricule existant.
 */
class MatriculeEtudiantService
{
    public const TABLE = 'sequence_matricule';
    public const CLE   = 'NI';

    /** Colonnes qui portent un matricule étudiant : un numéro présent dans l'une d'elles est réservé. */
    public const COLONNES = [
        'etudiant'          => 'matricule_etudiant',
        'inscription'       => 'matricule_etudiant',
        'certificat'        => 'matricule',
        'pointage_etudiant' => 'matricule_etudiant',
    ];

    public const MESSAGE_INDISPONIBLE = "Attribution du matricule indisponible pour l'instant. Réessayez.";

    /** Erreurs MySQL : délai d'attente d'un verrou dépassé, interblocage, table inconnue. */
    private const DELAI_DEPASSE  = 1205;
    private const INTERBLOCAGE   = 1213;
    private const TABLE_INCONNUE = 1146;

    /**
     * Attente maximale du verrou du compteur, en secondes. La valeur du
     * serveur peut être très longue (600 s constatées) : on ne laisse pas un
     * utilisateur attendre aussi longtemps.
     */
    public int $attenteVerrou = 5;

    /** Dernier numéro attribué (lecture simple, sans verrou). */
    public function dernierNumero(): int
    {
        try {
            $numero = DB::table(self::TABLE)->where('cle', self::CLE)->value('dernier_numero');
        } catch (QueryException $e) {
            throw $this->codeMySql($e) === self::TABLE_INCONNUE ? $this->compteurAbsent($e) : $e;
        }

        if ($numero === null) {
            throw $this->compteurAbsent();
        }

        return (int) $numero;
    }

    public function formater(int $numero): string
    {
        return 'NI-' . str_pad((string) $numero, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Motif reconnaissant un numéro quelle que soit son écriture historique :
     * « NI-3840 », « ni-3840 », « NI3840 », « 3840 », « ni-+3840 », « NI-03840 »,
     * avec ou sans espaces autour. Un autre préfixe (« BI-3840 ») n'est pas un
     * matricule NI. À appliquer sur la valeur en minuscules.
     *
     * Le même motif sert à la migration qui initialise le compteur : les deux
     * lisent l'historique de la même façon.
     */
    public static function motif(string $chiffres): string
    {
        return '^[[:space:]]*(ni)?[^[:alnum:]]*0*' . $chiffres . '[[:space:]]*$';
    }

    /** Vrai si ce numéro figure déjà dans l'une des quatre tables, sous n'importe quelle écriture. */
    public function estUtilise(int $numero): bool
    {
        $motif = self::motif((string) $numero);

        foreach (self::COLONNES as $table => $colonne) {
            // Le LIKE écarte d'abord les lignes qui ne contiennent pas ces
            // chiffres : avec un motif passé en paramètre, MySQL recompile
            // l'expression régulière à chaque ligne examinée (≈ 7 s sur la
            // table des paiements sans ce préfiltre, quelques ms avec).
            $existe = DB::table($table)
                ->where($colonne, 'like', '%' . $numero . '%')
                ->whereRaw("LOWER(`{$colonne}`) REGEXP ?", [$motif])
                ->exists();

            if ($existe) {
                return true;
            }
        }

        return false;
    }

    /**
     * Attribue le prochain matricule libre et le passe à $enregistrer, qui doit
     * l'écrire en base. Le tout dans UNE transaction : si l'écriture échoue,
     * le compteur revient à sa valeur et rien n'est créé.
     *
     * La ligne du compteur reste verrouillée jusqu'à la fin de la transaction
     * — y compris celle de l'appelant, s'il en a ouvert une : deux créations
     * simultanées passent l'une après l'autre et ne reçoivent jamais le même
     * numéro.
     *
     * Verrou indisponible (délai dépassé ou interblocage) : HttpException 503.
     *
     * Les annulations sont celles de DB::transaction(), sans rien y ajouter :
     *  - échec ordinaire (écriture refusée, exception de $enregistrer) : retour
     *    au point de sauvegarde, ou annulation de la transaction si c'est la
     *    nôtre ; la transaction de l'appelant reste intacte ;
     *  - délai de verrou dépassé (1205) : MySQL n'annule que l'instruction. Le
     *    verrou est demandé en PREMIER, donc rien n'a encore été écrit ;
     *  - interblocage (1213) : MySQL a annulé TOUTE la transaction, celle de
     *    l'appelant comprise.
     * Dans les deux derniers cas, l'appelant qui a ouvert une transaction ne
     * doit pas rattraper cette exception pour continuer et valider : il doit
     * la laisser remonter (ce que font tous les appelants actuels).
     */
    public function attribuer(callable $enregistrer): string
    {
        try {
            return DB::transaction(function () use ($enregistrer) {
                // Première instruction de la transaction (ou du point de
                // sauvegarde) : si le verrou n'est pas obtenu, rien n'a été écrit.
                $numero = $this->verrouillerCompteur();

                do {
                    $numero++;
                } while ($this->estUtilise($numero));

                DB::table(self::TABLE)->where('cle', self::CLE)->update([
                    'dernier_numero' => $numero,
                    'mis_a_jour_le'  => now(),
                ]);

                $matricule = $this->formater($numero);
                $enregistrer($matricule);

                return $matricule;
            });
        } catch (Throwable $e) {
            if ($this->verrouIndisponible($e)) {
                Log::warning('Matricule : verrou du compteur indisponible', ['exception' => $e]);

                throw new HttpException(503, self::MESSAGE_INDISPONIBLE, $e);
            }

            throw $e;
        }
    }

    /**
     * Verrouille la ligne du compteur et renvoie le dernier numéro attribué.
     * Le délai d'attente n'est réduit que pour cette lecture : la valeur de la
     * session est rétablie aussitôt, verrou obtenu ou non.
     */
    protected function verrouillerCompteur(): int
    {
        $precedent = (int) DB::selectOne('SELECT @@SESSION.innodb_lock_wait_timeout AS delai')->delai;
        DB::statement('SET SESSION innodb_lock_wait_timeout = ' . max(1, $this->attenteVerrou));

        try {
            $ligne = DB::table(self::TABLE)->where('cle', self::CLE)->lockForUpdate()->first();
        } catch (QueryException $e) {
            throw $this->codeMySql($e) === self::TABLE_INCONNUE ? $this->compteurAbsent($e) : $e;
        } finally {
            DB::statement('SET SESSION innodb_lock_wait_timeout = ' . $precedent);
        }

        if (!$ligne) {
            throw $this->compteurAbsent();
        }

        return (int) $ligne->dernier_numero;
    }

    private function verrouIndisponible(Throwable $e): bool
    {
        return in_array($this->codeMySql($e), [self::DELAI_DEPASSE, self::INTERBLOCAGE], true);
    }

    /**
     * Code d'erreur MySQL à l'origine de l'exception. Dans une transaction
     * imbriquée, Laravel enveloppe l'erreur dans une DeadlockException : on
     * remonte donc la chaîne jusqu'à l'erreur de requête d'origine.
     */
    private function codeMySql(Throwable $e): ?int
    {
        for ($cause = $e; $cause !== null; $cause = $cause->getPrevious()) {
            if ($cause instanceof QueryException && isset($cause->errorInfo[1])) {
                return (int) $cause->errorInfo[1];
            }
        }

        return null;
    }

    private function compteurAbsent(?Throwable $cause = null): RuntimeException
    {
        return new RuntimeException(
            "Le compteur des matricules (table « " . self::TABLE . " ») n'est pas initialisé : exécutez la migration 2026_10_15_000002_create_sequence_matricule_table.",
            0,
            $cause
        );
    }
}
