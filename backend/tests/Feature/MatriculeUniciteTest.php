<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\MatriculeEtudiantService;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PDOException;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

// Un matricule présent dans l'historique — fiche, paiement, certificat ou
// pointage, quelle que soit son écriture — n'est jamais redonné : un nouvel
// étudiant ne récupère aucun paiement d'un autre.
//
// Tests ordinaires : tout se passe dans la transaction annulée en fin de test.
// Le compteur retrouve donc sa valeur sans qu'on y touche. Les scénarios à
// plusieurs connexions (attente du verrou, créations simultanées) sont dans
// ConcurrenceTest.
class MatriculeUniciteTest extends TestCase
{
    private const MIGRATION = 'migrations/2026_10_15_000002_create_sequence_matricule_table.php';

    private MatriculeEtudiantService $service;
    private int $depart;
    private string $session;
    private array $environnement = [];

    protected function setUp(): void
    {
        parent::setUp();

        // Sans la table, rejouer la migration la créerait : une création de
        // table valide la transaction du test. On s'arrête donc avant.
        if (!Schema::hasTable(MatriculeEtudiantService::TABLE)) {
            $this->fail('La table sequence_matricule est absente de la base de test : exécutez d\'abord la migration 2026_10_15_000002 (avec --path).');
        }

        $this->actingAs(User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail());
        $this->service = app(MatriculeEtudiantService::class);
        $this->depart  = $this->service->dernierNumero();
        $this->session = DB::table('session')->orderByDesc('id')->value('code_session');

        foreach (['MATRICULE_DEPART_ATTENDU', 'MATRICULE_EXCLUSIONS'] as $nom) {
            $this->environnement[$nom] = [getenv($nom), $_ENV[$nom] ?? null, $_SERVER[$nom] ?? null];
        }
    }

    protected function tearDown(): void
    {
        foreach ($this->environnement as $nom => [$processus, $env, $serveur]) {
            $processus === false ? putenv($nom) : putenv("{$nom}={$processus}");
            if ($env === null) { unset($_ENV[$nom]); } else { $_ENV[$nom] = $env; }
            if ($serveur === null) { unset($_SERVER[$nom]); } else { $_SERVER[$nom] = $serveur; }
        }

        parent::tearDown();
    }

    /* ── outils ── */

    private function ni(int $decalage): string
    {
        return $this->service->formater($this->depart + $decalage);
    }

    private function creerEtudiant(): string
    {
        return $this->postJson('/api/etudiants', ['nom' => 'TESTPHPUNIT', 'prenom' => 'Unicite', 'sexe' => 'HOMME'])
            ->assertStatus(201)->json('matricule');
    }

    /** Paiement historique sans fiche étudiant, écrit directement (comme les données de l'ancien système). */
    private function paiementHistorique(string $matricule): void
    {
        DB::table('inscription')->insert([
            'date_paiement' => '2023-02-20 08:00:00', 'code_session' => $this->session, 'matricule_etudiant' => $matricule,
            'montant_paye' => 100000, 'type_paiement' => 'inscription', 'lieu_paiement' => 'TEST-PHPUNIT',
            'reste_a_payer' => 0, 'ref_facture' => 0, 'id_transaction' => 0,
        ]);
    }

    private function occuper(string $table, string $matricule): void
    {
        match ($table) {
            'inscription' => $this->paiementHistorique($matricule),
            'certificat'  => DB::table('certificat')->insert([
                'reference' => 'TEST-PHPUNIT-' . uniqid(), 'matricule' => $matricule,
                'debut_session' => '2099-03-01', 'fin_session' => '2099-03-31', 'accept' => 0, 'origine' => 'normal',
            ]),
            'pointage_etudiant' => DB::table('pointage_etudiant')->insert([
                'date' => '2023-02-20', 'matricule_etudiant' => $matricule, 'session' => $this->session, 'present' => 1,
            ]),
            'etudiant' => DB::table('etudiant')->insert([
                'matricule_etudiant' => $matricule, 'nom_etudiant' => 'TESTPHPUNIT', 'prenom_etudiant' => 'Ancien', 'sexe' => 'HOMME',
            ]),
        };
    }

    private function configurer(?string $attendu, ?string $exclusions): void
    {
        foreach (['MATRICULE_DEPART_ATTENDU' => $attendu, 'MATRICULE_EXCLUSIONS' => $exclusions] as $nom => $valeur) {
            if ($valeur === null) {
                putenv($nom);
                unset($_ENV[$nom], $_SERVER[$nom]);
            } else {
                putenv("{$nom}={$valeur}");
                $_ENV[$nom] = $_SERVER[$nom] = $valeur;
            }
        }
    }

    private function migration(): object
    {
        return require database_path(self::MIGRATION);
    }

    private function fixerCompteur(int $valeur): void
    {
        DB::table(MatriculeEtudiantService::TABLE)->where('cle', MatriculeEtudiantService::CLE)->update(['dernier_numero' => $valeur]);
    }

    /** Erreur MySQL simulée (délai de verrou dépassé, interblocage). */
    private function erreurMySql(int $code, string $message): QueryException
    {
        $pdo = new PDOException($message);
        $pdo->errorInfo = ['HY000', $code, $message];

        return new QueryException('mysql', 'select * from `sequence_matricule` where `cle` = ? for update', ['NI'], $pdo);
    }

    /* ── réservation des numéros de l'historique ── */

    public function test_le_numero_suivant_est_donne_quand_il_est_libre(): void
    {
        $this->assertFalse($this->service->estUtilise($this->depart + 1), 'La base de test ne doit rien contenir au-dessus du compteur.');

        $this->assertSame($this->ni(1), $this->creerEtudiant());
        $this->assertSame($this->depart + 1, $this->service->dernierNumero());
    }

    public static function tables(): array
    {
        return [['etudiant'], ['inscription'], ['certificat'], ['pointage_etudiant']];
    }

    /** @dataProvider tables */
    public function test_un_numero_present_dans_une_des_quatre_tables_est_saute(string $table): void
    {
        $this->occuper($table, $this->ni(1));

        $this->assertTrue($this->service->estUtilise($this->depart + 1));
        $this->assertSame($this->ni(2), $this->creerEtudiant());
    }

    public static function ecritures(): array
    {
        // %d = le numéro ; écritures relevées dans les données de l'ancien système.
        return [
            'majuscules'      => ['NI-%d'],
            'minuscules'      => ['ni-%d'],
            'sans tiret'      => ['NI%d'],
            'minuscules sans tiret' => ['ni%d'],
            'chiffres seuls'  => ['%d'],
            'signe parasite'  => ['ni-+%d'],
            'zéro de tête'    => ['NI-0%d'],
            'espaces autour'  => [' NI-%d '],
        ];
    }

    /** @dataProvider ecritures */
    public function test_un_numero_est_reserve_quelle_que_soit_son_ecriture_historique(string $format): void
    {
        $this->paiementHistorique(sprintf($format, $this->depart + 1));

        $this->assertSame($this->ni(2), $this->creerEtudiant());
    }

    public function test_plusieurs_numeros_occupes_a_la_suite_sont_tous_sautes(): void
    {
        $this->paiementHistorique($this->ni(1));
        $this->occuper('certificat', strtolower($this->ni(2)));
        $this->occuper('pointage_etudiant', $this->ni(3));

        $this->assertSame($this->ni(4), $this->creerEtudiant());
        $this->assertSame($this->ni(5), $this->creerEtudiant());
    }

    public function test_un_autre_prefixe_ou_un_numero_plus_long_ne_reserve_rien(): void
    {
        $suivant = $this->depart + 1;
        $this->paiementHistorique("BI-{$suivant}");       // autre préfixe : pas un matricule NI
        $this->paiementHistorique("NI-{$suivant}7");      // un autre numéro, plus long
        $this->paiementHistorique('Framework MVC');       // saisie sans numéro

        $this->assertSame($this->ni(1), $this->creerEtudiant());
    }

    public function test_un_nouvel_etudiant_ne_recupere_aucun_paiement_historique(): void
    {
        // Deux paiements de l'ancien système sur le numéro que l'ancien calcul aurait donné.
        $this->paiementHistorique($this->ni(1));
        $this->paiementHistorique(strtolower($this->ni(1)));

        $matricule = $this->creerEtudiant();

        $this->assertNotSame($this->ni(1), $matricule);
        $this->assertSame(0, DB::table('inscription')->where('matricule_etudiant', $matricule)->count());
        $this->assertSame(0, DB::table('certificat')->where('matricule', $matricule)->count());
        $this->assertSame(0, DB::table('pointage_etudiant')->where('matricule_etudiant', $matricule)->count());

        // Les écrans ne lui montrent ni paiement ni facture.
        $this->assertSame(0, $this->getJson('/api/inscriptions?search=' . $matricule)->assertOk()->json('total'));
        $this->postJson('/api/factures/verify', ['matricule' => $matricule])->assertStatus(404);

        // Les paiements historiques n'ont pas bougé.
        $this->assertSame(2, DB::table('inscription')->where('matricule_etudiant', $this->ni(1))->count());
    }

    public function test_un_certificat_manuel_saute_aussi_les_numeros_de_l_historique(): void
    {
        $this->paiementHistorique($this->ni(1));

        $reponse = $this->postJson('/api/certifications/manuel', [
            'nom_complet' => 'TEST PHPUNIT Manuel', 'nom_formation' => 'Formation de test',
            'date_debut' => '2099-03-01', 'date_fin' => '2099-03-31', 'lieu_paiement' => 'Ampandrana',
        ])->assertStatus(201);

        $this->assertSame($this->ni(2), $reponse->json('certificat.matricule'));
    }

    public function test_supprimer_le_dernier_etudiant_ne_libere_pas_son_numero(): void
    {
        $premier = $this->creerEtudiant();
        $this->deleteJson("/api/etudiants/{$premier}")->assertOk();
        $this->assertFalse(DB::table('etudiant')->where('matricule_etudiant', $premier)->exists());

        $this->assertSame($this->ni(2), $this->creerEtudiant());
    }

    /* ── échecs : rien de partiel, compteur cohérent ── */

    public function test_une_ecriture_qui_echoue_ne_consomme_pas_le_numero_et_ne_cree_rien(): void
    {
        $etudiants = DB::table('etudiant')->count();
        $niveau    = DB::transactionLevel();

        try {
            $this->service->attribuer(function (string $matricule) {
                DB::table('etudiant')->insert(['matricule_etudiant' => $matricule, 'nom_etudiant' => 'TESTPHPUNIT', 'prenom_etudiant' => 'Echec', 'sexe' => 'HOMME']);
                throw new RuntimeException('échec simulé après l\'écriture');
            });
            $this->fail("L'exception devait remonter.");
        } catch (RuntimeException $e) {
            $this->assertSame('échec simulé après l\'écriture', $e->getMessage());
        }

        $this->assertSame($this->depart, $this->service->dernierNumero(), 'Le compteur est revenu à sa valeur.');
        $this->assertSame($etudiants, DB::table('etudiant')->count(), 'La fiche écrite avant l\'échec est annulée.');
        $this->assertSame($niveau, DB::transactionLevel(), 'La transaction de l\'appelant est intacte.');
        $this->assertSame($this->ni(1), $this->creerEtudiant(), 'Le numéro abandonné est donné au suivant.');
    }

    public function test_sans_ligne_de_compteur_l_attribution_s_arrete_explicitement(): void
    {
        DB::table(MatriculeEtudiantService::TABLE)->where('cle', MatriculeEtudiantService::CLE)->delete();
        $etudiants = DB::table('etudiant')->count();

        try {
            $this->service->attribuer(fn (string $m) => $this->fail('Aucun matricule ne doit être attribué.'));
            $this->fail('Une erreur explicite était attendue.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString("n'est pas initialisé", $e->getMessage());
        }

        $this->postJson('/api/etudiants', ['nom' => 'TESTPHPUNIT', 'prenom' => 'Sans compteur', 'sexe' => 'HOMME'])->assertStatus(500);
        $this->assertSame($etudiants, DB::table('etudiant')->count());
    }

    public static function erreursDeVerrou(): array
    {
        return [
            'délai dépassé (1205)' => [1205, 'Lock wait timeout exceeded; try restarting transaction'],
            'interblocage (1213)'  => [1213, 'Deadlock found when trying to get lock; try restarting transaction'],
        ];
    }

    /**
     * Conversion des erreurs MySQL en 503, et état de la transaction après un
     * délai dépassé survenu DANS une transaction englobante (celle du test).
     * L'erreur est simulée ici ; ConcurrenceTest la provoque réellement.
     *
     * @dataProvider erreursDeVerrou
     */
    public function test_un_verrou_indisponible_devient_une_reponse_503_sans_rien_laisser(int $code, string $message): void
    {
        $erreur  = $this->erreurMySql($code, $message);
        $service = new class($erreur) extends MatriculeEtudiantService {
            public function __construct(private QueryException $erreur) {}
            protected function verrouillerCompteur(): int { throw $this->erreur; }
        };
        $niveau    = DB::transactionLevel();
        $etudiants = DB::table('etudiant')->count();

        try {
            $service->attribuer(fn (string $m) => $this->fail('Aucun matricule ne doit être attribué.'));
            $this->fail('Une HttpException 503 était attendue.');
        } catch (HttpException $e) {
            $this->assertSame(503, $e->getStatusCode());
            $this->assertSame(MatriculeEtudiantService::MESSAGE_INDISPONIBLE, $e->getMessage());
        }

        // État RÉEL : la transaction englobante est toujours ouverte côté MySQL,
        // et Laravel compte le même nombre de niveaux qu'avant l'appel.
        $this->assertTrue(DB::getPdo()->inTransaction());
        $this->assertSame($niveau, DB::transactionLevel());
        $this->assertSame($this->depart, $this->service->dernierNumero());

        // La réponse 503 arrive bien jusqu'au client, et rien n'est créé.
        $this->app->bind(MatriculeEtudiantService::class, fn () => $service);
        $this->postJson('/api/etudiants', ['nom' => 'TESTPHPUNIT', 'prenom' => 'Verrou', 'sexe' => 'HOMME'])
            ->assertStatus(503)->assertJsonPath('message', MatriculeEtudiantService::MESSAGE_INDISPONIBLE);
        $this->postJson('/api/certifications/manuel', [
            'nom_complet' => 'TEST PHPUNIT Verrou', 'nom_formation' => 'Formation de test', 'date_debut' => '2099-03-01', 'date_fin' => '2099-03-31',
        ])->assertStatus(503);

        $this->assertSame($etudiants, DB::table('etudiant')->count());
        $this->assertSame(0, DB::table('certificat')->where('nom_manuel', 'TEST PHPUNIT Verrou')->count());
        $this->assertSame($niveau, DB::transactionLevel());
    }

    public function test_la_modification_d_un_certificat_manuel_sans_matricule_est_tout_ou_rien(): void
    {
        $id = DB::table('certificat')->insertGetId([
            'reference' => 'TEST-PHPUNIT-SANS', 'matricule' => null, 'debut_session' => '2099-03-01', 'fin_session' => '2099-03-31',
            'accept' => 0, 'origine' => 'manuel', 'nom_manuel' => 'TEST PHPUNIT Ancien',
        ]);
        $corps = ['nom_complet' => 'TEST PHPUNIT Corrigé', 'nom_formation' => 'Formation de test', 'date_debut' => '2099-03-01', 'date_fin' => '2099-03-31', 'matricule' => ''];

        // Verrou indisponible : ni matricule, ni correction.
        $erreur = $this->erreurMySql(1205, 'Lock wait timeout exceeded; try restarting transaction');
        $this->app->bind(MatriculeEtudiantService::class, fn () => new class($erreur) extends MatriculeEtudiantService {
            public function __construct(private QueryException $erreur) {}
            protected function verrouillerCompteur(): int { throw $this->erreur; }
        });
        $this->putJson('/api/certifications/TEST-PHPUNIT-SANS', $corps)->assertStatus(503);
        $c = DB::table('certificat')->where('id', $id)->first();
        $this->assertNull($c->matricule);
        $this->assertSame('TEST PHPUNIT Ancien', $c->nom_manuel);

        // Service normal : le matricule et la correction arrivent ensemble.
        $this->app->bind(MatriculeEtudiantService::class, fn () => new MatriculeEtudiantService());
        $this->putJson('/api/certifications/TEST-PHPUNIT-SANS', $corps)->assertOk();
        $c = DB::table('certificat')->where('id', $id)->first();
        $this->assertSame($this->ni(1), $c->matricule);
        $this->assertSame('TEST PHPUNIT Corrigé', $c->nom_manuel);
    }

    /* ── un seul chemin de création ── */

    public function test_seul_le_service_attribue_un_matricule_aux_fiches_etudiant(): void
    {
        $insertions = [];
        $fichiers = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(app_path(), \FilesystemIterator::SKIP_DOTS));
        foreach ($fichiers as $fichier) {
            if ($fichier->getExtension() !== 'php') {
                continue;
            }
            $code = file_get_contents($fichier->getPathname());
            if (preg_match('/table\(\s*[\'"]etudiant[\'"]\s*\)\s*->\s*(insert|insertGetId|insertOrIgnore|upsert|updateOrInsert)\b|Etudiant::(create|insert|firstOrCreate|updateOrCreate|upsert)\b|new\s+Etudiant\b/', $code)) {
                $insertions[] = $fichier->getFilename();
            }
        }

        $this->assertSame(['EtudiantController.php'], $insertions, 'Toute création de fiche étudiant doit passer par MatriculeEtudiantService::attribuer().');
        $this->assertStringContainsString('MatriculeEtudiantService::class)->attribuer(', file_get_contents(app_path('Http/Controllers/EtudiantController.php')));
    }

    /* ── migration : valeur confirmée par environnement, compteur jamais abaissé ──
       La table existe déjà : rejouer up() ne crée donc aucune table. ── */

    public function test_la_migration_s_arrete_si_la_configuration_est_absente(): void
    {
        foreach ([[null, null], ['3839', null], [null, 'aucune'], ['', 'aucune'], ['trois mille', 'aucune'], ['3839', ''], ['3839', '14265,x']] as [$attendu, $exclusions]) {
            $this->configurer($attendu, $exclusions);

            try {
                $this->migration()->up();
                $this->fail('Arrêt attendu pour ' . json_encode([$attendu, $exclusions]));
            } catch (RuntimeException $e) {
                $this->assertStringContainsString('Compteur des matricules NON créé', $e->getMessage());
            }
        }

        $this->assertSame($this->depart, $this->service->dernierNumero());
    }

    public function test_la_migration_s_arrete_si_la_valeur_attendue_ne_correspond_pas_aux_donnees(): void
    {
        $maximum = $this->migration()->inventaire()['maximum'];

        foreach ([$maximum - 1, $maximum + 1] as $attendu) {
            $this->configurer((string) $attendu, 'aucune');

            try {
                $this->migration()->up();
                $this->fail("Arrêt attendu pour la valeur {$attendu}.");
            } catch (RuntimeException $e) {
                $this->assertStringContainsString("le plus grand numéro calculé est {$maximum}", $e->getMessage());
                $this->assertStringContainsString('Inventaire', $e->getMessage());
            }
        }

        $this->assertSame($this->depart, $this->service->dernierNumero());
    }

    public function test_un_numero_aberrant_n_impose_pas_le_depart_s_il_est_exclu_explicitement(): void
    {
        $maximum  = $this->migration()->inventaire()['maximum'];
        $aberrant = $maximum + 100000;
        $this->paiementHistorique("NI-{$aberrant}");
        $this->fixerCompteur($maximum - 10);

        // Sans l'exclusion, la valeur attendue ne correspond plus : arrêt.
        $this->configurer((string) $maximum, 'aucune');
        try {
            $this->migration()->up();
            $this->fail('Arrêt attendu : le numéro aberrant est devenu le maximum.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString("le plus grand numéro calculé est {$aberrant}", $e->getMessage());
        }

        // Une exclusion absente des données est une configuration incohérente.
        $this->configurer((string) $maximum, $aberrant . ',' . ($aberrant + 1));
        try {
            $this->migration()->up();
            $this->fail('Arrêt attendu : exclusion introuvable.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('introuvable', $e->getMessage());
        }
        $this->assertSame($maximum - 10, $this->service->dernierNumero());

        // Avec l'exclusion : le départ est le vrai maximum, et le paiement aberrant est intact.
        $this->configurer((string) $maximum, (string) $aberrant);
        $this->migration()->up();

        $this->assertSame($maximum, $this->service->dernierNumero());
        $this->assertSame(1, DB::table('inscription')->where('matricule_etudiant', "NI-{$aberrant}")->count());
        // Le jour où la série l'atteint, le service le saute.
        $this->assertTrue($this->service->estUtilise($aberrant));
    }

    public function test_la_migration_rejouee_n_abaisse_jamais_le_compteur_et_down_garde_la_table(): void
    {
        $maximum = $this->migration()->inventaire()['maximum'];
        $this->configurer((string) $maximum, 'aucune');

        $this->fixerCompteur($maximum + 50);
        $this->migration()->up();
        $this->assertSame($maximum + 50, $this->service->dernierNumero(), 'Un compteur en avance est conservé.');

        $this->migration()->down();
        $this->assertTrue(Schema::hasTable(MatriculeEtudiantService::TABLE));
        $this->assertSame($maximum + 50, $this->service->dernierNumero());
    }

    public function test_la_migration_ne_modifie_aucune_donnee_historique(): void
    {
        $empreinte = fn () => [
            DB::table('etudiant')->count(), DB::table('inscription')->count(), DB::table('certificat')->count(), DB::table('pointage_etudiant')->count(),
            DB::table('inscription')->selectRaw('MD5(GROUP_CONCAT(matricule_etudiant ORDER BY id_paiement)) e')->value('e'),
            DB::table('certificat')->selectRaw("MD5(GROUP_CONCAT(IFNULL(matricule,'') ORDER BY id)) e")->value('e'),
        ];
        DB::statement('SET SESSION group_concat_max_len = 1000000');
        $avant = $empreinte();

        $this->configurer((string) $this->migration()->inventaire()['maximum'], 'aucune');
        $this->migration()->up();

        $this->assertSame($avant, $empreinte());
    }
}
