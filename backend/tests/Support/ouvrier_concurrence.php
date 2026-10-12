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
//   attendre : fichier dont on attend l'apparition avant de commencer
//   emettre  : fichier créé une fois l'opération faite (transaction encore ouverte)
//   maintien : durée, en ms, pendant laquelle la transaction reste ouverte
//
// Répond par UNE ligne JSON : { ok, statut, message, attente_ms, … }.

use App\Http\Controllers\GererController;
use App\Services\DepenseService;
use App\Services\IndicateursTresorerieService;
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
