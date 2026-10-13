<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Compteur des matricules « NI- » (table `sequence_matricule`, une ligne).
 *
 * Le compteur démarre au plus grand numéro déjà présent dans l'historique
 * (fiches étudiant, paiements, certificats, pointages), toutes écritures
 * confondues. Cette valeur n'est PAS devinée : elle doit être confirmée pour
 * chaque environnement, après inventaire de ses données, par deux variables
 * d'environnement —
 *
 *   MATRICULE_DEPART_ATTENDU  le plus grand numéro attendu (ex. 3839) ;
 *   MATRICULE_EXCLUSIONS      les numéros aberrants à ignorer pour ce calcul,
 *                             séparés par des virgules (ex. 14265), ou
 *                             « aucune » s'il n'y en a pas.
 *
 * Variable absente, exclusion introuvable dans les données, ou valeur
 * calculée différente de la valeur attendue : la migration s'arrête AVANT de
 * créer quoi que ce soit, et affiche l'inventaire.
 *
 * Aucune table existante n'est modifiée et aucun matricule n'est corrigé : un
 * numéro exclu reste dans l'historique, et le service le sautera le jour où
 * la série l'atteindra.
 *
 * Rejouable : le compteur n'est jamais abaissé. down() ne supprime rien,
 * volontairement — recréer la table recalculerait le compteur depuis les
 * tables, et un numéro attribué puis supprimé sans laisser de trace pourrait
 * être redonné.
 *
 * À exécuter seule :
 *   php artisan migrate --path=database/migrations/2026_10_15_000002_create_sequence_matricule_table.php
 */
return new class extends Migration
{
    private const TABLE = 'sequence_matricule';
    private const CLE   = 'NI';

    /** Mêmes colonnes que MatriculeEtudiantService::COLONNES (copiées : une migration ne dépend pas du code applicatif). */
    private const COLONNES = [
        'etudiant'          => 'matricule_etudiant',
        'inscription'       => 'matricule_etudiant',
        'certificat'        => 'matricule',
        'pointage_etudiant' => 'matricule_etudiant',
    ];

    public function up(): void
    {
        // Tous les contrôles d'abord : la création d'une table ne s'annule pas.
        [$attendu, $exclusions] = $this->configuration();
        $inventaire = $this->inventaire($exclusions);

        $introuvables = array_values(array_diff($exclusions, $inventaire['exclus_trouves']));
        if ($introuvables !== []) {
            $this->arreter('exclusion(s) introuvable(s) dans les données : ' . implode(', ', $introuvables), $inventaire);
        }
        $inutiles = array_values(array_filter($exclusions, fn (int $n) => $n <= $attendu));
        if ($inutiles !== []) {
            $this->arreter("exclusion(s) inférieure(s) ou égale(s) au départ attendu ({$attendu}) : " . implode(', ', $inutiles), $inventaire);
        }
        if ($inventaire['maximum'] !== $attendu) {
            $this->arreter("le plus grand numéro calculé est {$inventaire['maximum']}, la valeur attendue est {$attendu}", $inventaire);
        }

        if (!Schema::hasTable(self::TABLE)) {
            Schema::create(self::TABLE, function (Blueprint $table) {
                $table->engine = 'InnoDB';
                $table->string('cle', 20)->primary();
                $table->unsignedBigInteger('dernier_numero');
                $table->dateTime('mis_a_jour_le')->nullable();
            });
        }

        DB::transaction(function () use ($attendu) {
            $ligne = DB::table(self::TABLE)->where('cle', self::CLE)->lockForUpdate()->first();

            if (!$ligne) {
                DB::table(self::TABLE)->insert(['cle' => self::CLE, 'dernier_numero' => $attendu, 'mis_a_jour_le' => now()]);
            } elseif ((int) $ligne->dernier_numero < $attendu) {
                // Jamais abaissé : on ne fait que rattraper l'historique.
                DB::table(self::TABLE)->where('cle', self::CLE)->update(['dernier_numero' => $attendu, 'mis_a_jour_le' => now()]);
            }
        });
    }

    public function down(): void
    {
        // Voir l'en-tête : la table et son compteur sont conservés.
    }

    /**
     * Lecture seule. Pour chaque table : le plus grand numéro reconnu (hors
     * exclusions) et les valeurs non reconnues comme matricule NI.
     *
     * @param  int[]  $exclusions
     * @return array{maximum:int, par_table:array<string,int>, exclus_trouves:int[], non_reconnus:array<string,string[]>}
     */
    public function inventaire(array $exclusions = []): array
    {
        $parTable = [];
        $nonReconnus = [];
        $exclusTrouves = [];

        foreach (self::COLONNES as $table => $colonne) {
            $parTable[$table] = 0;

            $valeurs = DB::table($table)->whereNotNull($colonne)->distinct()->pluck($colonne);
            foreach ($valeurs as $valeur) {
                $numero = $this->numero((string) $valeur);

                if ($numero === null) {
                    if (trim((string) $valeur) !== '') {
                        $nonReconnus[$table][] = (string) $valeur;
                    }
                    continue;
                }
                if (in_array($numero, $exclusions, true)) {
                    $exclusTrouves[] = $numero;
                    continue;
                }

                $parTable[$table] = max($parTable[$table], $numero);
            }
        }

        return [
            'maximum'        => max($parTable),
            'par_table'      => $parTable,
            'exclus_trouves' => array_values(array_unique($exclusTrouves)),
            'non_reconnus'   => $nonReconnus,
        ];
    }

    /**
     * Numéro porté par une valeur, ou null. Même lecture que
     * MatriculeEtudiantService::motif() : « NI-3840 », « ni3840 », « 3840 »,
     * « ni-+3840 »… ; un autre préfixe (« BI-2928 ») n'est pas un matricule NI.
     */
    private function numero(string $valeur): ?int
    {
        if (!preg_match('/^\s*(?:ni)?[^a-z0-9]*0*(\d+)\s*$/', mb_strtolower($valeur), $m)) {
            return null;
        }

        return (int) $m[1];
    }

    /** @return array{0:int, 1:int[]} [départ attendu, exclusions] */
    private function configuration(): array
    {
        $attendu = env('MATRICULE_DEPART_ATTENDU');
        if (!is_string($attendu) || !ctype_digit(trim($attendu))) {
            $this->arreter('MATRICULE_DEPART_ATTENDU est absente ou n\'est pas un nombre entier');
        }

        $brut = env('MATRICULE_EXCLUSIONS');
        if (!is_string($brut) || trim($brut) === '') {
            $this->arreter('MATRICULE_EXCLUSIONS est absente (indiquez « aucune » s\'il n\'y a aucun numéro à ignorer)');
        }

        $exclusions = [];
        if (mb_strtolower(trim($brut)) !== 'aucune') {
            foreach (explode(',', $brut) as $morceau) {
                if (!ctype_digit(trim($morceau))) {
                    $this->arreter("MATRICULE_EXCLUSIONS contient une valeur qui n'est pas un numéro : « {$morceau} »");
                }
                $exclusions[] = (int) trim($morceau);
            }
        }

        return [(int) trim($attendu), array_values(array_unique($exclusions))];
    }

    private function arreter(string $raison, ?array $inventaire = null): never
    {
        $message = "Compteur des matricules NON créé : {$raison}.";

        if ($inventaire !== null) {
            $message .= ' Inventaire — plus grand numéro par table : ' . json_encode($inventaire['par_table'], JSON_UNESCAPED_UNICODE)
                . ' ; exclusions trouvées : ' . json_encode($inventaire['exclus_trouves'])
                . ' ; valeurs non reconnues : ' . json_encode($inventaire['non_reconnus'], JSON_UNESCAPED_UNICODE) . '.';
        }

        throw new RuntimeException($message . ' Vérifiez MATRICULE_DEPART_ATTENDU et MATRICULE_EXCLUSIONS pour cet environnement.');
    }
};
