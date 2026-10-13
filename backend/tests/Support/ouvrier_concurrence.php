<?php
// Ouvrier des tests de concurrence (Tests\Feature\ConcurrenceTest).
//
// PHPUnit travaille sur UNE connexion : il ne peut pas voir un verrou. Ce
// script est donc lancé comme un PROCESSUS SÉPARÉ, avec sa propre connexion.
// Il exécute une opération dans une transaction qu'il peut garder ouverte
// quelques instants (« maintien ») : l'autre processus doit alors attendre le
// verrou, et le temps d'attente mesuré prouve que les deux se chevauchaient.
//
// Usage : php ouvrier_concurrence.php '<json>'
//   action   : payer | annuler-paiement | virement | retrait | supprimer-virement
//              | supprimer-gestion | croises | ecrivain | lecteur
//              | export | export-temoin
//              | matricule-creer | matricule-imbrique | matricule-temoin
//   attendre : fichier dont on attend l'apparition avant de commencer
//   emettre  : fichier créé une fois l'opération faite (transaction encore ouverte)
//   maintien : durée, en ms, pendant laquelle la transaction reste ouverte
//
// Répond par UNE ligne JSON : { ok, statut, message, attente_ms, … }.

use App\Http\Controllers\GererController;
use App\Http\Controllers\LogistiqueController;
use App\Services\DepenseService;
use App\Services\IndicateursTresorerieService;
use App\Services\MatriculeEtudiantService;
use App\Services\TresorerieService;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

$racine = dirname(__DIR__, 2);
require $racine . '/vendor/autoload.php';
$app = require $racine . '/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$repondre = function (array $r): never { echo json_encode($r, JSON_UNESCAPED_UNICODE) . PHP_EOL; exit(0); };

// GARDE-FOU : jamais ailleurs que sur une base de test, suivi activé.
$base = (string) DB::connection()->getDatabaseName();
if (!str_ends_with($base, '_test') || getenv('DB_DATABASE') !== $base) {
    $repondre(['ok' => false, 'statut' => 0, 'message' => "REFUS : base « {$base} »"]);
}
if (!DepenseService::actif()) {
    $repondre(['ok' => false, 'statut' => 0, 'message' => "REFUS : le suivi n'est pas activé pour ce processus"]);
}

$a = json_decode($argv[1] ?? '{}', true);
$action = $a['action'] ?? '';
$ms = fn (float $t0) => (int) round((microtime(true) - $t0) * 1000);
$attendre = function (?string $fichier, int $maxSecondes = 20): void {
    $fin = microtime(true) + $maxSecondes;
    while ($fichier && !file_exists($fichier) && microtime(true) < $fin) { usleep(2000); }
};

/* ── opérations répétées : virements croisés, écrivain, lecteur ── */

if ($action === 'croises') {
    $service = app(TresorerieService::class);
    $attendre($a['attendre'] ?? null);
    $ok = 0; $refus = 0; $erreurs = [];
    for ($i = 0; $i < $a['nombre']; $i++) {
        try { $service->creerVirement($a['de'], $a['vers'], 10, null, true); $ok++; }
        catch (HttpExceptionInterface $e) { $refus++; }
        catch (Throwable $e) { $erreurs[] = substr($e->getMessage(), 0, 80); }
    }
    $repondre(['ok' => $erreurs === [], 'reussis' => $ok, 'refuses' => $refus, 'erreurs' => array_values(array_unique($erreurs))]);
}

if ($action === 'ecrivain') {
    $depenses = app(DepenseService::class); $tresorerie = app(TresorerieService::class);
    $attendre($a['attendre'] ?? null);
    $operations = 0;
    try {
        for ($i = 0; $i < $a['cycles']; $i++) {
            $depenses->payer('achat', $a['id'], $a['compte'], $a['user']); $operations++;
            $tresorerie->creerVirement($a['compte'], $a['autre'], 10, $a['user'], true); $operations++;
            $depenses->annulerPaiement('achat', $a['id'], 'TEST-CONC cycle', $a['user']); $operations++;
            $tresorerie->creerVirement($a['autre'], $a['compte'], 10, $a['user'], true); $operations++;
        }
    } catch (Throwable $e) {
        touch($a['emettre']);
        $repondre(['ok' => false, 'operations' => $operations, 'message' => substr($e->getMessage(), 0, 160)]);
    }
    touch($a['emettre']);
    $repondre(['ok' => true, 'operations' => $operations]);
}

if ($action === 'lecteur') {
    $service = app(IndicateursTresorerieService::class);
    $du = now()->startOfMonth(); $au = now()->endOfMonth();
    $lire = function () use ($service, $du, $au) { $i = $service->indicateurs($du, $au); return [$i['tresorerie']['total'], $i['engage']['total'], $i['decaisse']['total'], $i['disponible_reel']]; };
    [$t0, $e0, $d0, $dispo0] = $lire();           // référence : l'écrivain n'a pas encore démarré
    touch($a['emettre']);
    $lectures = 0; $incoherentes = 0; $vuePayee = 0; $vueEngagee = 0; $exemple = null;
    $fin = microtime(true) + 60;
    while (!file_exists($a['fin']) && microtime(true) < $fin) {
        [$t, $e, $d, $dispo] = $lire(); $lectures++;
        // Vrai à tout instant, que la dépense soit engagée ou payée :
        //  - payer ou annuler un paiement ne change pas le disponible réel ;
        //  - la dépense est SOIT engagée, SOIT décaissée ;
        //  - ce qui est décaissé a quitté la trésorerie, ni plus ni moins.
        if ($dispo != $dispo0 || $e + $d != $e0 + $d0 || $t + $d != $t0 + $d0) { $incoherentes++; $exemple ??= compact('t', 'e', 'd', 'dispo'); continue; }
        $d > $d0 ? $vuePayee++ : $vueEngagee++;
    }
    $repondre(['ok' => $incoherentes === 0, 'lectures' => $lectures, 'incoherentes' => $incoherentes, 'vue_payee' => $vuePayee, 'vue_engagee' => $vueEngagee, 'exemple' => $exemple]);
}

/* ── export : une seule image de la base, du début à la fin de la lecture ── */

if ($action === 'export' || $action === 'export-temoin') {
    // Dès la PREMIÈRE lecture de la table des achats, on s'arrête : on prévient
    // le test (« emettre ») et on attend qu'il ait inséré et VALIDÉ une nouvelle
    // dépense (« attendre »). Toutes les lectures suivantes ont donc lieu APRÈS
    // cette insertion. Aucune temporisation : seuls les deux signaux rythment
    // le scénario.
    $premiere = true;
    DB::listen(function ($requete) use (&$premiere, $a, $attendre) {
        if ($premiere && str_contains($requete->sql, '`achat`')) {
            $premiere = false;
            touch($a['emettre']);
            $attendre($a['attendre']);
        }
    });

    if ($action === 'export') {
        // Le vrai export de l'application, avec sa transaction.
        $d = app(LogistiqueController::class)->exportAchats(Request::create('/x', 'GET', ['search' => $a['recherche']]))->getData(true);
        [$annonce, $lignes, $total] = [$d['total'], $d['data'], $d['total_montant']];
    } else {
        // Témoin : les mêmes lectures SANS transaction. Elles doivent se
        // contredire — sinon le scénario ne prouverait rien.
        $q = fn () => DB::table('achat as a')->where('a.nom_materiel', 'like', '%' . $a['recherche'] . '%');
        $annonce = $q()->count();
        $total   = $q()->sum('a.montant');
        $lignes  = $q()->get()->map(fn ($l) => (array) $l)->all();
    }

    $repondre([
        'ok' => true, 'annonce' => $annonce, 'recues' => count($lignes),
        'total_montant' => (float) $total, 'somme' => (float) array_sum(array_column($lignes, 'montant')),
        // Lu APRÈS l'export : la dépense insérée pendant la lecture est bien dans la base.
        'apres' => DB::table('achat')->where('nom_materiel', 'like', '%' . $a['recherche'] . '%')->count(),
    ]);
}

/* ── matricules : attribution sous verrou, depuis une transaction de l'appelant ──
 *
 *   matricule-creer    : type = etudiant | certificat. Ouvre une transaction,
 *                        demande un matricule au service et écrit la ligne ;
 *                        options : pret (fichier créé quand le processus est
 *                        prêt), annuler (annule au lieu de valider),
 *                        attente_verrou (secondes).
 *   matricule-imbrique : écrit d'abord une ligne témoin dans SA transaction,
 *                        puis demande un matricule ; rapporte l'état réel de
 *                        la transaction après l'échec, et la valide.
 *   matricule-temoin   : l'ANCIEN mécanisme (lire le plus grand numéro, ajouter
 *                        un, écrire — sous un verrou nommé relâché AVANT la
 *                        validation). Il doit produire un doublon, sinon le
 *                        scénario ne prouverait rien. Il travaille sur une
 *                        série à part (« serie », ex. TEMOIN-65F0A1-), jamais
 *                        sur la série NI ni sur des données existantes.
 *
 *   journal (obligatoire) : fichier où CHAQUE ligne écrite est notée, par sa
 *   clé primaire, juste après l'écriture et AVANT la validation. Une ligne
 *   validée est donc toujours au journal ; si le processus meurt avant de
 *   l'avoir notée, sa transaction n'a pas été validée et la ligne n'existe
 *   pas. Le test ne supprime que ce que le journal désigne. */

if (str_starts_with($action, 'matricule-')) {
    $marque = 'TEST-CONC';
    if (empty($a['journal'])) {
        $repondre(['ok' => false, 'statut' => 0, 'message' => 'REFUS : journal des lignes écrites absent']);
    }
    $noter = function (string $table, string|int $cle) use ($a): void {
        file_put_contents($a['journal'], json_encode(['table' => $table, 'cle' => $cle]) . PHP_EOL, FILE_APPEND | LOCK_EX);
    };

    $service = app(MatriculeEtudiantService::class);
    if (isset($a['attente_verrou'])) { $service->attenteVerrou = (int) $a['attente_verrou']; }
    $connexion = (int) DB::selectOne('SELECT CONNECTION_ID() AS id')->id;

    /** Écrit un certificat de test et renvoie [clé primaire, référence]. */
    $certificat = function (?string $matricule, string $genre) use ($marque, $noter): array {
        $reference = "{$marque}-{$genre}-" . str_replace('.', '', uniqid('', true));
        $id = (int) DB::table('certificat')->insertGetId([
            'reference' => $reference, 'matricule' => $matricule,
            'debut_session' => '2099-03-01', 'fin_session' => '2099-03-31', 'accept' => 0,
            'origine' => 'manuel', 'nom_manuel' => $marque,
        ]);
        $noter('certificat', $id);

        return [$id, $reference];
    };
    /** Écrit la ligne demandée et renvoie sa clé primaire. */
    $ecrire = function (string $type, string $matricule) use ($marque, $noter, $certificat): string|int {
        if ($type === 'certificat') {
            return $certificat($matricule, 'CERT')[0];
        }
        DB::table('etudiant')->insert([
            'matricule_etudiant' => $matricule, 'nom_etudiant' => $marque, 'prenom_etudiant' => 'Matricule',
            'sexe' => 'HOMME', 'matricule_s' => $marque,
        ]);
        $noter('etudiant', $matricule);

        return $matricule;
    };

    if (!empty($a['pret'])) { touch($a['pret']); }
    $attendre($a['attendre'] ?? null);
    $t0 = microtime(true);
    DB::beginTransaction();

    try {
        if ($action === 'matricule-creer') {
            $cle = null;
            $matricule = $service->attribuer(function (string $m) use ($ecrire, $a, &$cle) { $cle = $ecrire($a['type'], $m); });
            $attente = $ms($t0);
            if (!empty($a['emettre'])) { touch($a['emettre']); }
            usleep(((int) ($a['maintien'] ?? 0)) * 1000);
            empty($a['annuler']) ? DB::commit() : DB::rollBack();
            $repondre(['ok' => true, 'statut' => 200, 'message' => empty($a['annuler']) ? 'accepté' : 'annulé', 'attente_ms' => $attente, 'matricule' => $matricule, 'type' => $a['type'], 'cle' => $cle, 'connexion' => $connexion]);
        }

        if ($action === 'matricule-imbrique') {
            // Ce que l'appelant écrit dans SA transaction, avant de demander un matricule.
            [$id, $reference] = $certificat(null, 'IMB');

            $statut = 200; $message = 'accepté';
            try {
                $service->attribuer(fn (string $m) => $ecrire('etudiant', $m));
            } catch (HttpExceptionInterface $e) {
                [$statut, $message] = [$e->getStatusCode(), $e->getMessage()];
            }
            $attente = $ms($t0);

            // État après le refus : niveau compté par Laravel, et ce que la
            // transaction voit encore de sa propre écriture. La preuve finale
            // est faite par le test, de l'extérieur, après la validation.
            $niveau  = DB::transactionLevel();
            $ouverte = DB::getPdo()->inTransaction();
            $visible = DB::table('certificat')->where('id', $id)->exists();
            DB::commit();

            $repondre(['ok' => $statut === 200, 'statut' => $statut, 'message' => $message, 'attente_ms' => $attente, 'niveau' => $niveau, 'transaction_ouverte' => $ouverte, 'temoin_visible' => $visible, 'id' => $id, 'reference' => $reference, 'connexion' => $connexion]);
        }

        if ($action === 'matricule-temoin') {
            $serie = (string) ($a['serie'] ?? '');
            if (!preg_match('/^TEMOIN-[A-Z0-9]+-$/', $serie)) {
                throw new InvalidArgumentException('série de test invalide');
            }

            DB::selectOne('SELECT GET_LOCK(?, 10) AS ok', ['test_conc_matricule_temoin']);
            try {
                // Comme l'ancien service : « le plus grand numéro + 1 », lu
                // sans voir ce qu'une autre transaction n'a pas encore validé.
                $dernier = (int) DB::table('certificat')->where('matricule', 'like', $serie . '%')
                    ->max(DB::raw('CAST(SUBSTRING(matricule, ' . (strlen($serie) + 1) . ') AS UNSIGNED)'));
                $matricule = $serie . str_pad((string) ($dernier + 1), 4, '0', STR_PAD_LEFT);
                [$id, $reference] = $certificat($matricule, 'TEMOIN');
            } finally {
                DB::selectOne('SELECT RELEASE_LOCK(?) AS ok', ['test_conc_matricule_temoin']);
            }
            $attente = $ms($t0);
            if (!empty($a['emettre'])) { touch($a['emettre']); }
            usleep(((int) ($a['maintien'] ?? 0)) * 1000);
            DB::commit();
            $repondre(['ok' => true, 'statut' => 200, 'message' => 'accepté', 'attente_ms' => $attente, 'matricule' => $matricule, 'id' => $id, 'reference' => $reference, 'connexion' => $connexion]);
        }

        throw new InvalidArgumentException("action inconnue : {$action}");
    } catch (HttpExceptionInterface $e) {
        $attente = $ms($t0);
        // État au moment où le refus remonte, avant d'annuler.
        $etat = ['niveau' => DB::transactionLevel(), 'transaction_ouverte' => DB::getPdo()->inTransaction()];
        DB::rollBack();
        $repondre(['ok' => false, 'statut' => $e->getStatusCode(), 'message' => $e->getMessage(), 'attente_ms' => $attente, 'connexion' => $connexion] + $etat);
    } catch (Throwable $e) {
        $attente = $ms($t0);
        DB::rollBack();
        $repondre(['ok' => false, 'statut' => 500, 'message' => 'ERREUR ' . substr($e->getMessage(), 0, 160), 'attente_ms' => $attente, 'connexion' => $connexion]);
    }
}

/* ── opérations uniques, dans une transaction qui peut être gardée ouverte ── */

$attendre($a['attendre'] ?? null);
$t0 = microtime(true);
DB::beginTransaction();
try {
    $statut = 200; $message = 'accepté';
    switch ($action) {
        case 'payer':
            app(DepenseService::class)->payer($a['type'], $a['id'], $a['compte'], $a['user']);
            break;
        case 'annuler-paiement':
            app(DepenseService::class)->annulerPaiement($a['type'], $a['id'], 'TEST-CONC annulation', $a['user']);
            break;
        case 'virement':
            app(TresorerieService::class)->creerVirement($a['de'], $a['vers'], $a['montant'], $a['user'] ?? null, $a['journal'] ?? true);
            break;
        case 'supprimer-virement':
            app(TresorerieService::class)->supprimerVirement($a['id'], $a['user'] ?? null, $a['journal'] ?? true);
            break;
        case 'retrait':
            $rep = app(GererController::class)->store(Request::create('/x', 'POST', ['compte' => $a['compte'], 'type' => 'S', 'montant' => $a['montant'], 'raison' => 'TEST-CONC retrait']));
            [$statut, $message] = [$rep->getStatusCode(), $rep->getData(true)['message'] ?? ''];
            break;
        case 'supprimer-gestion':
            $rep = app(GererController::class)->destroy($a['id']);
            [$statut, $message] = [$rep->getStatusCode(), $rep->getData(true)['message'] ?? ''];
            break;
        default:
            throw new InvalidArgumentException("action inconnue : {$action}");
    }
    $attente = $ms($t0);
    if ($statut >= 400) {
        DB::rollBack();
        $repondre(['ok' => false, 'statut' => $statut, 'message' => $message, 'attente_ms' => $attente]);
    }
    if (!empty($a['emettre'])) { touch($a['emettre']); }
    usleep(((int) ($a['maintien'] ?? 0)) * 1000);
    DB::commit();
    $repondre(['ok' => true, 'statut' => $statut, 'message' => $message, 'attente_ms' => $attente]);
} catch (HttpExceptionInterface $e) {
    $attente = $ms($t0);
    DB::rollBack();
    $repondre(['ok' => false, 'statut' => $e->getStatusCode(), 'message' => $e->getMessage(), 'attente_ms' => $attente]);
} catch (Throwable $e) {
    $attente = $ms($t0);
    DB::rollBack();
    $repondre(['ok' => false, 'statut' => 500, 'message' => 'ERREUR ' . substr($e->getMessage(), 0, 160), 'attente_ms' => $attente]);
}
