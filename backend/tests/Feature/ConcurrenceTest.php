<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\MatriculeEtudiantService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Process\Process;
use Tests\Support\VerifieIntegriteFinanciere;
use Tests\TestCase;

// Concurrence : verrous, doubles paiements, soldes et compensations, avec de
// VRAIS processus séparés (tests/Support/ouvrier_concurrence.php), chacun sur
// sa propre connexion à la base de test.
//
// Ces tests ne peuvent pas tourner dans la transaction annulée des autres
// tests : un processus séparé ne verrait pas des données non validées. Ils
// écrivent donc réellement dans la base de test, avec des données marquées
// « TEST-CONC », supprimées avant et après chaque test ; tearDown() vérifie
// qu'il n'en reste rien.
class ConcurrenceTest extends TestCase
{
    use VerifieIntegriteFinanciere;

    private const MARQUE   = 'TEST-CONC';
    private const MAINTIEN = 700;   // ms pendant lesquelles le premier processus garde son verrou
    private const ATTENTE  = 350;   // ms d'attente minimale exigée du second : preuve du chevauchement

    private int $admin;
    private string $dossier;
    private string $historique;

    /** Aucune transaction englobante : les données doivent être visibles des autres processus. */
    protected function connectionsToTransact(): array
    {
        return [];
    }

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin   = (int) User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail()->id;
        $this->dossier = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'nirinfo-conc-' . uniqid();
        mkdir($this->dossier);

        $this->nettoyer();                       // restes d'une exécution interrompue
        $this->historique = $this->empreinteHistorique();
    }

    protected function tearDown(): void
    {
        $this->nettoyer();
        $restes = $this->restes();
        array_map('unlink', glob($this->dossier . DIRECTORY_SEPARATOR . '*') ?: []);
        @rmdir($this->dossier);

        $this->assertSame(0, array_sum($restes), 'Données de test résiduelles : ' . json_encode($restes));

        parent::tearDown();
    }

    /* ── données de test, isolées par leur marque ── */

    private function compte(string $nom, int $solde): int
    {
        return DB::table('compte')->insertGetId(['account_number' => self::MARQUE, 'libelle' => self::MARQUE . " {$nom}", 'montant' => $solde], 'id_compte');
    }

    /** Achat déjà validé, prêt à être payé. */
    private function achatValide(string $nom, int $montant): int
    {
        return DB::table('achat')->insertGetId([
            'nom_materiel' => self::MARQUE . " {$nom}", 'prix_unitaire' => $montant, 'quantite' => 1, 'montant' => $montant, 'date_achat' => now()->toDateString(), 'photo_achat' => '',
            'id_transaction' => 0, 'matricule_s' => $this->admin, 'statut' => 'validee', 'valide_par' => $this->admin, 'date_validation' => now(),
        ], 'id_achat');
    }

    private function solde(int $compte): float
    {
        return (float) DB::table('compte')->where('id_compte', $compte)->value('montant');
    }

    private function comptesDeTest()
    {
        return DB::table('compte')->where('libelle', 'like', self::MARQUE . ' %')->pluck('id_compte');
    }

    private function nettoyer(): void
    {
        $comptes = $this->comptesDeTest();
        $achats  = DB::table('achat')->where('nom_materiel', 'like', self::MARQUE . ' %')->pluck('id_achat');
        $journal = DB::table('transaction')->whereIn('account', $comptes)->pluck('id_transaction');

        DB::table('depense_evenements')->where('type_depense', 'achat')->whereIn('id_depense', $achats)->delete();
        DB::table('transfer')->whereIn('starting_account', $comptes)->orWhereIn('destination_account', $comptes)->delete();
        DB::table('gestion_compte')->whereIn('id_transaction', $journal)->delete();
        DB::table('transaction')->whereIn('id_transaction', $journal)->delete();
        DB::table('achat')->whereIn('id_achat', $achats)->delete();
        DB::table('compte')->whereIn('id_compte', $comptes)->delete();

        $this->nettoyerMatricules();
    }

    /**
     * Matricules : on ne supprime QUE les lignes que les processus de CE test
     * ont notées au journal, une par une, par leur clé primaire — et seulement
     * si elles portent bien la marque de test. Jamais par marque seule, jamais
     * par matricule, jamais par plage de numéros. Le compteur n'est pas touché.
     *
     * Un processus note chaque ligne avant de valider sa transaction : une
     * ligne validée est toujours au journal. Si une exécution est tuée avant
     * ce nettoyage, ses lignes restent en base : restes() les signalera, et
     * elles se retirent à la main, après examen.
     */
    private function nettoyerMatricules(): void
    {
        foreach ($this->lignesDuJournal() as ['table' => $table, 'cle' => $cle]) {
            if ($table === 'etudiant') {
                $this->fichesDeTest()->where('matricule_etudiant', $cle)->delete();
            } elseif ($table === 'certificat') {
                $this->certificatsDeTest()->where('id', $cle)->delete();
            }
        }
    }

    /** @return array<int, array{table: string, cle: string|int}> */
    private function lignesDuJournal(): array
    {
        $journal = $this->signal('journal-matricules');
        if (!file_exists($journal)) {
            return [];
        }

        return array_values(array_filter(array_map(
            fn (string $ligne) => json_decode($ligne, true),
            file($journal, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)
        ), fn ($l) => is_array($l) && isset($l['table'], $l['cle'])));
    }

    private function fichesDeTest()
    {
        return DB::table('etudiant')->where('nom_etudiant', self::MARQUE)->where('matricule_s', self::MARQUE);
    }

    private function certificatsDeTest()
    {
        return DB::table('certificat')->where('origine', 'manuel')->where('nom_manuel', self::MARQUE)->where('reference', 'like', self::MARQUE . '-%');
    }

    private function restes(): array
    {
        return [
            'comptes'   => DB::table('compte')->where('libelle', 'like', self::MARQUE . ' %')->count(),
            'achats'    => DB::table('achat')->where('nom_materiel', 'like', self::MARQUE . ' %')->count(),
            'écritures' => DB::table('transaction')->where('reson', 'like', self::MARQUE . '%')->count(),
            'virements journalisés' => DB::table('transfer')->whereNotNull('id_transaction_debit')->count(),
            'écritures de virement' => DB::table('transaction')->whereIn('type_operation', ['virement', 'annulation_virement'])->count(),
            'événements' => DB::table('depense_evenements')->count(),
            'fiches étudiant' => $this->fichesDeTest()->count(),
            'certificats'     => $this->certificatsDeTest()->count(),
        ];
    }

    /* ── lancement des processus ── */

    private function lancer(array $ordre): Process
    {
        // Les processus qui écrivent des matricules notent leurs lignes au journal du test.
        if (str_starts_with($ordre['action'] ?? '', 'matricule-')) {
            $ordre += ['journal' => $this->signal('journal-matricules')];
        }

        $p = new Process([PHP_BINARY, base_path('tests/Support/ouvrier_concurrence.php'), json_encode($ordre)], base_path(), [
            'DB_DATABASE' => DB::connection()->getDatabaseName(), 'DEPENSES_WORKFLOW' => 'true', 'APP_ENV' => 'testing', 'MAIL_MAILER' => 'array',
        ]);
        $p->setTimeout(90);
        $p->start();

        return $p;
    }

    private function resultat(Process $p): array
    {
        $p->wait();
        $r = json_decode(trim($p->getOutput()), true);
        $this->assertIsArray($r, 'Réponse illisible du processus : ' . $p->getOutput() . $p->getErrorOutput());
        $this->assertStringNotContainsString('REFUS', (string) ($r['message'] ?? ''), 'Le processus a refusé de travailler.');

        return $r;
    }

    private function signal(string $nom): string
    {
        return $this->dossier . DIRECTORY_SEPARATOR . $nom;
    }

    /**
     * Le premier processus fait son opération et GARDE sa transaction ouverte ;
     * le second démarre à ce moment-là et doit attendre le verrou.
     *
     * @return array{0: array, 1: array} résultats du premier et du second
     */
    private function duel(array $premier, array $second): array
    {
        $signal = $this->signal('duel-' . uniqid());
        $p1 = $this->lancer($premier + ['emettre' => $signal, 'maintien' => self::MAINTIEN]);
        $p2 = $this->lancer($second + ['attendre' => $signal]);
        $r1 = $this->resultat($p1);
        $r2 = $this->resultat($p2);

        $this->assertTrue($r1['ok'], 'Le premier processus devait réussir : ' . json_encode($r1, JSON_UNESCAPED_UNICODE));
        $this->assertGreaterThanOrEqual(self::ATTENTE, $r2['attente_ms'], "Le second processus n'a pas attendu le verrou du premier : les deux opérations ne se chevauchaient pas.");

        return [$r1, $r2];
    }

    private function conclure(): void
    {
        $this->assertIntegriteFinanciere();
        $this->assertSame(0, DB::table('compte')->whereIn('id_compte', $this->comptesDeTest())->whereRaw('CAST(montant AS DECIMAL(20,2)) < 0')->count(), 'Aucun compte de test ne doit être négatif.');
        $this->assertSame($this->historique, $this->empreinteHistorique(), "Les dépenses de l'ancien système ne doivent pas avoir bougé.");
    }

    /* ── paiements ── */

    public function test_la_meme_depense_payee_deux_fois_en_meme_temps_n_est_payee_qu_une_fois(): void
    {
        $compte = $this->compte('A', 5000);
        $achat  = $this->achatValide('double', 800);
        $ordre  = ['action' => 'payer', 'type' => 'achat', 'id' => $achat, 'compte' => $compte, 'user' => $this->admin];

        [, $second] = $this->duel($ordre, $ordre);

        $this->assertFalse($second['ok']);
        $this->assertSame(422, $second['statut'], $second['message']);
        $this->assertSame(4200.0, $this->solde($compte), 'Le compte est débité une seule fois.');
        $this->assertSame('payee', DB::table('achat')->where('id_achat', $achat)->value('statut'));
        $this->assertSame(1, DB::table('transaction')->where('origine_table', 'achat')->where('origine_id', $achat)->count(), 'Une seule sortie au journal.');
        $this->assertSame(['paiement'], DB::table('depense_evenements')->where('type_depense', 'achat')->where('id_depense', $achat)->pluck('action')->all());
        $this->conclure();
    }

    public function test_deux_depenses_payees_en_meme_temps_ne_vident_pas_le_compte_deux_fois(): void
    {
        $compte = $this->compte('A', 1000);
        $d1 = $this->achatValide('un', 800);
        $d2 = $this->achatValide('deux', 800);

        [, $second] = $this->duel(
            ['action' => 'payer', 'type' => 'achat', 'id' => $d1, 'compte' => $compte, 'user' => $this->admin],
            ['action' => 'payer', 'type' => 'achat', 'id' => $d2, 'compte' => $compte, 'user' => $this->admin],
        );

        $this->assertFalse($second['ok']);
        $this->assertStringStartsWith('Solde insuffisant', $second['message']);
        $this->assertSame(200.0, $this->solde($compte));
        $this->assertSame(['payee', 'validee'], [DB::table('achat')->where('id_achat', $d1)->value('statut'), DB::table('achat')->where('id_achat', $d2)->value('statut')]);
        $this->conclure();
    }

    public function test_le_meme_paiement_annule_deux_fois_en_meme_temps_n_est_compense_qu_une_fois(): void
    {
        $compte = $this->compte('A', 1000);
        $achat  = $this->achatValide('annulation', 800);
        app(\App\Services\DepenseService::class)->payer('achat', $achat, $compte, $this->admin);
        $this->assertSame(200.0, $this->solde($compte));
        $ordre = ['action' => 'annuler-paiement', 'type' => 'achat', 'id' => $achat, 'user' => $this->admin];

        [, $second] = $this->duel($ordre, $ordre);

        $this->assertFalse($second['ok']);
        $this->assertSame(422, $second['statut'], $second['message']);
        $this->assertSame(1000.0, $this->solde($compte), 'Le compte est recrédité une seule fois.');
        $this->assertSame('validee', DB::table('achat')->where('id_achat', $achat)->value('statut'));
        $this->assertSame(1, DB::table('transaction')->where('account', $compte)->whereNotNull('transaction_annulee_id')->count(), 'Une seule compensation.');
        $this->conclure();
    }

    /* ── paiement contre retrait manuel, dans les deux ordres ── */

    public function test_un_retrait_manuel_puis_un_paiement_sur_le_meme_compte(): void
    {
        $compte = $this->compte('A', 1000);
        $achat  = $this->achatValide('apres-retrait', 800);

        [, $second] = $this->duel(
            ['action' => 'retrait', 'compte' => $compte, 'montant' => 800],
            ['action' => 'payer', 'type' => 'achat', 'id' => $achat, 'compte' => $compte, 'user' => $this->admin],
        );

        $this->assertFalse($second['ok']);
        $this->assertStringStartsWith('Solde insuffisant', $second['message']);
        $this->assertSame(200.0, $this->solde($compte));
        $this->assertSame('validee', DB::table('achat')->where('id_achat', $achat)->value('statut'));
        $this->conclure();
    }

    public function test_un_paiement_puis_un_retrait_manuel_sur_le_meme_compte(): void
    {
        $compte = $this->compte('A', 1000);
        $achat  = $this->achatValide('avant-retrait', 800);

        [, $second] = $this->duel(
            ['action' => 'payer', 'type' => 'achat', 'id' => $achat, 'compte' => $compte, 'user' => $this->admin],
            ['action' => 'retrait', 'compte' => $compte, 'montant' => 800],
        );

        $this->assertFalse($second['ok']);
        $this->assertSame('Solde insuffisant pour ce retrait', $second['message']);
        $this->assertSame(200.0, $this->solde($compte));
        $this->assertSame(0, DB::table('transaction')->where('account', $compte)->where('reson', 'like', self::MARQUE . '%')->count(), 'Le retrait refusé ne laisse aucune écriture.');
        $this->conclure();
    }

    /* ── virements ── */

    public function test_deux_virements_en_meme_temps_ne_vident_pas_le_compte_deux_fois(): void
    {
        $a = $this->compte('A', 1000); $b = $this->compte('B', 0); $c = $this->compte('C', 0);

        [, $second] = $this->duel(
            ['action' => 'virement', 'de' => $a, 'vers' => $b, 'montant' => 800],
            ['action' => 'virement', 'de' => $a, 'vers' => $c, 'montant' => 800],
        );

        $this->assertFalse($second['ok']);
        $this->assertSame('Solde insuffisant sur le compte de départ', $second['message']);
        $this->assertSame([200.0, 800.0, 0.0], [$this->solde($a), $this->solde($b), $this->solde($c)]);
        $this->assertSame(2, DB::table('transaction')->whereIn('account', [$a, $b, $c])->count(), 'Un seul virement : une sortie et une entrée.');
        $this->conclure();
    }

    public function test_des_virements_croises_ne_se_bloquent_pas_mutuellement(): void
    {
        $a = $this->compte('A', 100000); $b = $this->compte('B', 100000);
        $depart = $this->signal('depart');
        $processus = [];
        foreach ([[$a, $b], [$b, $a], [$a, $b], [$b, $a]] as [$de, $vers]) {
            $processus[] = $this->lancer(['action' => 'croises', 'de' => $de, 'vers' => $vers, 'nombre' => 60, 'attendre' => $depart]);
        }
        usleep(1500000);          // les quatre processus sont prêts
        touch($depart);           // départ simultané

        foreach ($processus as $p) {
            $r = $this->resultat($p);
            $this->assertSame([], $r['erreurs'], 'Aucun interblocage ni erreur : ' . json_encode($r, JSON_UNESCAPED_UNICODE));
            $this->assertSame([60, 0], [$r['reussis'], $r['refuses']]);
        }

        $this->assertSame([100000.0, 100000.0], [$this->solde($a), $this->solde($b)], 'Autant dans un sens que dans l\'autre : soldes inchangés.');
        $this->assertSame(480, DB::table('transaction')->whereIn('account', [$a, $b])->where('type_operation', 'virement')->count(), '240 virements, deux écritures chacun.');
        $this->conclure();
    }

    public function test_le_meme_virement_supprime_deux_fois_en_meme_temps_n_est_annule_qu_une_fois(): void
    {
        $service = app(\App\Services\TresorerieService::class);

        foreach ([true, false] as $journal) {
            $mode = $journal ? 'journalisé' : 'ancien mode';
            $a = $this->compte("A {$mode}", 5000); $b = $this->compte("B {$mode}", 1000);
            $virement = $service->creerVirement($a, $b, 500, $this->admin, $journal);
            $ordre = ['action' => 'supprimer-virement', 'id' => $virement, 'journal' => $journal];

            [, $second] = $this->duel($ordre, $ordre);

            $this->assertFalse($second['ok'], $mode);
            $this->assertSame(404, $second['statut'], "{$mode} : {$second['message']}");
            $this->assertSame([5000.0, 1000.0], [$this->solde($a), $this->solde($b)], "{$mode} : les soldes sont rétablis une seule fois.");
            $this->assertSame(0, DB::table('transfer')->where('id_transfer', $virement)->count());
            $this->assertSame($journal ? 4 : 0, DB::table('transaction')->whereIn('account', [$a, $b])->count(), "{$mode} : deux écritures et deux compensations, ou rien.");
        }
        $this->conclure();
    }

    /* ── opérations de la Gestion ── */

    public function test_la_meme_operation_de_gestion_supprimee_deux_fois_n_est_annulee_qu_une_fois(): void
    {
        $compte = $this->compte('A', 1000);
        $depot  = DB::table('transaction')->insertGetId(['transaction_type' => 'E', 'amount' => 500, 'reson' => self::MARQUE . ' dépôt', 'account' => $compte], 'id_transaction');
        DB::table('compte')->where('id_compte', $compte)->update(['montant' => 1500]);
        $ordre = ['action' => 'supprimer-gestion', 'id' => $depot];

        [, $second] = $this->duel($ordre, $ordre);

        $this->assertFalse($second['ok']);
        $this->assertSame(404, $second['statut'], $second['message']);
        $this->assertSame(1000.0, $this->solde($compte), 'Le dépôt est retiré une seule fois.');
        $this->conclure();
    }

    /* ── lecture des indicateurs pendant des écritures ── */

    public function test_les_indicateurs_restent_coherents_pendant_des_paiements_et_des_virements(): void
    {
        $a = $this->compte('A', 100000); $b = $this->compte('B', 100000);
        $achat = $this->achatValide('lecture', 800);
        $pret = $this->signal('lecteurs-prets'); $fin = $this->signal('fin');

        $lecteurs = [$this->lancer(['action' => 'lecteur', 'emettre' => $pret, 'fin' => $fin]), $this->lancer(['action' => 'lecteur', 'emettre' => $this->signal('pret-2'), 'fin' => $fin])];
        $ecrivain = $this->lancer(['action' => 'ecrivain', 'id' => $achat, 'compte' => $a, 'autre' => $b, 'user' => $this->admin, 'cycles' => 40, 'attendre' => $pret, 'emettre' => $fin]);

        $e = $this->resultat($ecrivain);
        $this->assertTrue($e['ok'], json_encode($e, JSON_UNESCAPED_UNICODE));
        $this->assertSame(160, $e['operations']);

        foreach ($lecteurs as $p) {
            $r = $this->resultat($p);
            $this->assertSame(0, $r['incoherentes'], 'Lecture incohérente : ' . json_encode($r, JSON_UNESCAPED_UNICODE));
            $this->assertGreaterThan(10, $r['lectures'], 'Le lecteur doit avoir réellement lu pendant les écritures.');
        }

        $this->assertSame([100000.0, 100000.0], [$this->solde($a), $this->solde($b)]);
        $this->assertSame('validee', DB::table('achat')->where('id_achat', $achat)->value('statut'));
        $this->conclure();
    }

    /* ── export : une seule image de la base ── */

    public function test_un_export_garde_la_meme_image_malgre_une_insertion_validee_pendant_sa_lecture(): void
    {
        $this->achatValide('export 1', 800);
        $this->achatValide('export 2', 700);
        $marques = fn () => DB::table('achat')->where('nom_materiel', 'like', self::MARQUE . ' %')->count();

        // « export-temoin » : les mêmes lectures sans transaction. Elles DOIVENT se contredire, sinon le
        // scénario ne prouverait rien. « export » : le vrai export de l'application, avec sa transaction.
        foreach (['export-temoin', 'export'] as $action) {
            $avant  = $marques();
            $lu     = $this->signal("lu-{$action}");
            $insere = $this->signal("insere-{$action}");
            $p = $this->lancer(['action' => $action, 'recherche' => self::MARQUE, 'emettre' => $lu, 'attendre' => $insere]);

            // Le processus a fait sa première lecture et attend : on insère et on VALIDE une dépense
            // (ce test n'a pas de transaction englobante : l'insertion est immédiatement visible des autres).
            for ($fin = microtime(true) + 20; !file_exists($lu) && microtime(true) < $fin;) { usleep(2000); }
            $this->assertFileExists($lu, "{$action} : le processus n'a pas commencé sa lecture.");
            $this->achatValide("export pendant {$action}", 500);
            touch($insere);

            $r = $this->resultat($p);
            $this->assertTrue($r['ok'], json_encode($r, JSON_UNESCAPED_UNICODE));
            $this->assertSame($avant + 1, $r['apres'], "{$action} : l'insertion a bien été validée pendant la lecture.");
            $this->assertSame($avant, $r['annonce'], "{$action} : le nombre de lignes a été lu avant l'insertion.");

            if ($action === 'export-temoin') {
                $this->assertSame($avant + 1, $r['recues'], 'Sans transaction, les lectures se contredisent : le scénario est probant.');
            } else {
                $this->assertSame($avant, $r['recues'], "L'export ne voit pas la dépense insérée pendant sa lecture.");
                $this->assertSame($r['total_montant'], $r['somme'], "Le total de l'export est celui de ses lignes.");
            }
        }

        $this->conclure();
    }

    /* ── matricules : un numéro n'est jamais donné deux fois ──
     *
     * L'ouvrier demande son matricule DANS une transaction qu'il garde ouverte :
     * c'est le cas que l'ancien verrou (relâché avant la validation) ne couvrait
     * pas. Ces tests n'écrivent jamais dans le compteur eux-mêmes et ne le
     * remettent pas à sa valeur : il avance, c'est tout. */

    private const TENUE = 3000;   // ms pendant lesquelles un processus garde le verrou du compteur, pour les scénarios de délai

    private function compteur(): int
    {
        $this->assertTrue(Schema::hasTable(MatriculeEtudiantService::TABLE), 'La table sequence_matricule est absente de la base de test : exécutez la migration 2026_10_15_000002 (avec --path).');

        return app(MatriculeEtudiantService::class)->dernierNumero();
    }

    /** Matricules réellement présents en base, parmi les lignes de test. */
    private function matriculesEcrits(): array
    {
        $tous = $this->fichesDeTest()->pluck('matricule_etudiant')->merge($this->certificatsDeTest()->whereNotNull('matricule')->pluck('matricule'))->all();
        sort($tous);

        return $tous;
    }

    /** Un processus tient le verrou du compteur puis annule ; l'autre arrive pendant ce temps avec un délai d'une seconde. */
    private function contreUnVerrouTenu(string $action): array
    {
        $signal = $this->signal('tenu-' . uniqid());
        $p1 = $this->lancer(['action' => 'matricule-creer', 'type' => 'etudiant', 'emettre' => $signal, 'maintien' => self::TENUE, 'annuler' => true]);
        $p2 = $this->lancer(['action' => $action, 'type' => 'etudiant', 'attendre' => $signal, 'attente_verrou' => 1]);
        $r1 = $this->resultat($p1);
        $r2 = $this->resultat($p2);

        $this->assertTrue($r1['ok'], json_encode($r1, JSON_UNESCAPED_UNICODE));
        $this->assertNotSame($r1['connexion'], $r2['connexion'], 'Deux connexions distinctes.');
        // Arrêté par le délai du verrou, et par rien d'autre : il a attendu au
        // moins ce délai, et a renoncé avant que le premier ne libère le verrou.
        $this->assertGreaterThanOrEqual(900, $r2['attente_ms'], json_encode($r2, JSON_UNESCAPED_UNICODE));
        $this->assertLessThan(self::TENUE - 300, $r2['attente_ms'], json_encode($r2, JSON_UNESCAPED_UNICODE));
        $this->assertSame(503, $r2['statut'], json_encode($r2, JSON_UNESCAPED_UNICODE));
        $this->assertSame(MatriculeEtudiantService::MESSAGE_INDISPONIBLE, $r2['message']);

        return $r2;
    }

    public function test_deux_etudiants_crees_en_meme_temps_recoivent_deux_matricules(): void
    {
        $avant = $this->compteur();
        $ordre = ['action' => 'matricule-creer', 'type' => 'etudiant'];

        [$premier, $second] = $this->duel($ordre, $ordre);

        $this->assertTrue($second['ok'], json_encode($second, JSON_UNESCAPED_UNICODE));
        $this->assertNotSame($premier['connexion'], $second['connexion'], 'Deux connexions distinctes.');
        $this->assertNotSame($premier['matricule'], $second['matricule']);
        $attendus = [$premier['matricule'], $second['matricule']];
        sort($attendus);
        $this->assertSame($attendus, $this->matriculesEcrits(), 'Les deux fiches existent, chacune avec son matricule.');
        $this->assertGreaterThanOrEqual($avant + 2, $this->compteur());
    }

    public function test_un_etudiant_et_un_certificat_manuel_en_meme_temps_ne_partagent_pas_un_numero(): void
    {
        [$premier, $second] = $this->duel(
            ['action' => 'matricule-creer', 'type' => 'etudiant'],
            ['action' => 'matricule-creer', 'type' => 'certificat'],
        );

        $this->assertTrue($second['ok'], json_encode($second, JSON_UNESCAPED_UNICODE));
        $this->assertNotSame($premier['matricule'], $second['matricule']);
        $this->assertSame([$premier['matricule']], $this->fichesDeTest()->pluck('matricule_etudiant')->all());
        $this->assertSame([$second['matricule']], $this->certificatsDeTest()->pluck('matricule')->all());
    }

    public function test_une_creation_annulee_rend_son_numero_au_suivant_sans_rien_laisser(): void
    {
        $avant = $this->compteur();

        [$premier, $second] = $this->duel(
            ['action' => 'matricule-creer', 'type' => 'etudiant', 'annuler' => true],
            ['action' => 'matricule-creer', 'type' => 'etudiant'],
        );

        $this->assertSame('annulé', $premier['message']);
        $this->assertTrue($second['ok'], json_encode($second, JSON_UNESCAPED_UNICODE));
        // Le second a attendu la fin du premier (vérifié par duel()), puis a lu
        // le compteur tel que l'annulation l'a laissé : il reçoit le même numéro.
        $this->assertSame($premier['matricule'], $second['matricule']);
        $this->assertSame([$second['matricule']], $this->matriculesEcrits(), 'Une seule fiche : celle du second.');
        $this->assertSame($avant + 1, $this->compteur(), 'Un seul numéro consommé.');
    }

    public function test_un_verrou_tenu_trop_longtemps_donne_une_reponse_503_et_ne_cree_rien(): void
    {
        $avant = $this->compteur();

        $second = $this->contreUnVerrouTenu('matricule-creer');

        // Le service est revenu au point de sauvegarde : la transaction de
        // l'appelant existe toujours, et Laravel en compte bien une seule.
        $this->assertTrue($second['transaction_ouverte']);
        $this->assertSame(1, $second['niveau']);
        $this->assertSame([], $this->matriculesEcrits());
        $this->assertSame($avant, $this->compteur(), 'Le premier a annulé, le second a été refusé : aucun numéro consommé.');
    }

    public function test_apres_un_delai_de_verrou_la_transaction_de_l_appelant_est_reellement_intacte(): void
    {
        $avant = $this->compteur();

        $second = $this->contreUnVerrouTenu('matricule-imbrique');

        // État rapporté par le processus juste après le refus…
        $this->assertTrue($second['transaction_ouverte'], 'MySQL : la transaction englobante est toujours ouverte.');
        $this->assertSame(1, $second['niveau'], 'Laravel : un seul niveau de transaction, celui de l\'appelant.');
        $this->assertTrue($second['temoin_visible']);
        // … et prouvé de l'extérieur : ce que l'appelant avait écrit AVANT de
        // demander le matricule a bien été validé par SA validation, et rien
        // de l'attribution refusée n'a été gardé.
        $temoin = DB::table('certificat')->where('id', $second['id'])->first();
        $this->assertNotNull($temoin, 'La ligne témoin de l\'appelant est validée.');
        $this->assertSame($second['reference'], $temoin->reference);
        $this->assertNull($temoin->matricule);
        $this->assertSame(0, $this->fichesDeTest()->count(), 'Aucune fiche créée par l\'attribution refusée.');
        $this->assertSame($avant, $this->compteur());
    }

    public function test_dix_creations_simultanees_recoivent_dix_matricules_distincts(): void
    {
        $avant  = $this->compteur();
        $depart = $this->signal('depart-' . uniqid());
        $tenue  = 100;   // ms pendant lesquelles chacun garde sa transaction ouverte

        $processus = [];
        $prets = [];
        for ($i = 0; $i < 10; $i++) {
            $prets[$i] = $this->signal("pret-{$i}-" . uniqid());
            $processus[$i] = $this->lancer(['action' => 'matricule-creer', 'type' => $i % 2 ? 'certificat' : 'etudiant', 'pret' => $prets[$i], 'attendre' => $depart, 'maintien' => $tenue]);
        }

        // Les dix processus sont démarrés et attendent le signal : ils partent ensemble.
        for ($fin = microtime(true) + 60; count(array_filter($prets, 'file_exists')) < 10 && microtime(true) < $fin;) { usleep(5000); }
        $this->assertCount(10, array_filter($prets, 'file_exists'), 'Les dix processus doivent être prêts avant le départ.');
        $t0 = microtime(true);
        touch($depart);

        $resultats = array_map(fn (Process $p) => $this->resultat($p), $processus);
        $duree = (int) round((microtime(true) - $t0) * 1000);

        foreach ($resultats as $r) {
            $this->assertTrue($r['ok'], json_encode($r, JSON_UNESCAPED_UNICODE));
        }
        $matricules = array_column($resultats, 'matricule');
        sort($matricules);
        $this->assertCount(10, array_unique($matricules), 'Dix matricules distincts : ' . implode(', ', $matricules));
        $this->assertCount(10, array_unique(array_column($resultats, 'connexion')), 'Dix connexions distinctes.');
        $this->assertSame($matricules, $this->matriculesEcrits(), 'Les dix lignes existent, chacune avec son matricule.');
        $this->assertSame(5, $this->fichesDeTest()->count());
        $this->assertSame(5, $this->certificatsDeTest()->count());

        // Preuve du chevauchement : chacun garde le verrou 100 ms, donc dix
        // passages l'un après l'autre durent au moins ~1 s et le k-ième attend
        // ~(k-1) × 100 ms. Sans verrou, la durée et les attentes seraient nulles.
        $this->assertGreaterThanOrEqual(8 * $tenue, $duree, 'Les dix créations sont passées l\'une après l\'autre.');
        $this->assertGreaterThanOrEqual(2250, array_sum(array_column($resultats, 'attente_ms')), 'Les processus ont attendu le verrou les uns des autres.');

        foreach ($matricules as $m) {
            $this->assertGreaterThan($avant, (int) substr($m, 3));
        }
        $this->assertGreaterThanOrEqual($avant + 10, $this->compteur());
    }

    public function test_temoin_l_ancien_mecanisme_donne_deux_fois_le_meme_numero(): void
    {
        $this->compteur();

        // Série de test à part, propre à CETTE exécution : elle n'appartient
        // pas à la série NI (le service et la migration ne la reconnaissent
        // pas comme un matricule) et ne peut désigner aucune donnée existante.
        // On le vérifie quand même, en lecture seule, dans les quatre tables.
        $serie = 'TEMOIN-' . strtoupper(uniqid()) . '-';
        foreach (MatriculeEtudiantService::COLONNES as $table => $colonne) {
            $this->assertSame(0, DB::table($table)->where($colonne, 'like', $serie . '%')->count(), "La série de test {$serie} existe déjà dans {$table}.");
        }

        // Même déroulement que duel() : le premier écrit puis garde sa
        // transaction ouverte, le second arrive pendant ce temps. Avec l'ANCIEN
        // mécanisme (plus grand numéro + 1, verrou nommé relâché avant la
        // validation), la ligne du premier n'est pas encore visible : le second
        // calcule le même numéro. Ce doublon DOIT apparaître, sinon les tests
        // ci-dessus ne prouveraient rien.
        $signal = $this->signal('temoin-' . uniqid());
        $p1 = $this->lancer(['action' => 'matricule-temoin', 'serie' => $serie, 'emettre' => $signal, 'maintien' => self::MAINTIEN]);
        $p2 = $this->lancer(['action' => 'matricule-temoin', 'serie' => $serie, 'attendre' => $signal]);
        $r1 = $this->resultat($p1);
        $r2 = $this->resultat($p2);

        $this->assertTrue($r1['ok'] && $r2['ok'], json_encode([$r1, $r2], JSON_UNESCAPED_UNICODE));
        $this->assertNotSame($r1['connexion'], $r2['connexion'], 'Deux connexions distinctes.');
        $this->assertLessThan(self::ATTENTE, $r2['attente_ms'], 'L\'ancien mécanisme ne fait pas attendre le second.');

        // Les deux certificats sont relus par leur clé primaire.
        $this->assertNotSame($r1['id'], $r2['id']);
        $c1 = DB::table('certificat')->where('id', $r1['id'])->first();
        $c2 = DB::table('certificat')->where('id', $r2['id'])->first();
        $this->assertNotNull($c1);
        $this->assertNotNull($c2);
        $this->assertSame([$r1['reference'], $r2['reference']], [$c1->reference, $c2->reference]);
        $this->assertStringStartsWith($serie, $c1->matricule);
        $this->assertSame($c1->matricule, $c2->matricule, 'Ancien mécanisme : le même numéro est donné deux fois — le scénario est probant.');
        // Rien d'autre que ces deux lignes ne porte la série de test.
        $this->assertSame([$r1['id'], $r2['id']], DB::table('certificat')->where('matricule', 'like', $serie . '%')->orderBy('id')->pluck('id')->all());

        // Le même déroulement avec le service actuel : deux numéros. (Les deux
        // lignes du témoin sont retirées par leur clé, depuis le journal.)
        $this->nettoyerMatricules();
        $this->assertSame(0, DB::table('certificat')->whereIn('id', [$r1['id'], $r2['id']])->count());
        [$premier, $second] = $this->duel(
            ['action' => 'matricule-creer', 'type' => 'certificat'],
            ['action' => 'matricule-creer', 'type' => 'certificat'],
        );
        $this->assertTrue($second['ok'], json_encode($second, JSON_UNESCAPED_UNICODE));
        $this->assertNotSame($premier['matricule'], $second['matricule']);
    }
}
