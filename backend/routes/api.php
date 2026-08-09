<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ModuleController;
use App\Http\Controllers\SessionController;
use App\Http\Controllers\HoraireController;
use App\Http\Controllers\EtudiantController;
use App\Http\Controllers\InscriptionController;
use App\Http\Controllers\RecouvrementController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\FactureController;
use App\Http\Controllers\CertificationController;
use App\Http\Controllers\EtatController;
use App\Http\Controllers\EcheanceController;
use App\Http\Controllers\LogistiqueController;
use App\Http\Controllers\PersonnelController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\PrestationController;
use App\Http\Controllers\CompteController;
use App\Http\Controllers\GererController;
use App\Http\Controllers\TransferController;

// ── Routes publiques — throttle par route (le groupe global 'api' n'a plus de throttle) ──
Route::middleware('throttle:6,1')->group(function () {
    Route::post('/login',          [AuthController::class, 'login']);
    Route::post('/reset-password', [AuthController::class, 'resetPassword']);
});

Route::middleware('throttle:3,60')->group(function () {
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
});

// ── Routes protégées ──
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::get ('/user',    [AuthController::class, 'me']);
    Route::post('/logout',  [AuthController::class, 'logout']);
    Route::put ('/profile', [AuthController::class, 'updateProfile']);
    Route::post('/users',   [AuthController::class, 'createUser']);
    Route::get ('/roles',   fn() => response()->json(
        \Illuminate\Support\Facades\DB::table('roles')->select('id', 'name', 'slug')->get()
    ));

    // Dashboard
    Route::get('/dashboard/stats',  [DashboardController::class, 'stats']);
    Route::get('/dashboard/charts', [DashboardController::class, 'charts']);

    // Formations
    Route::apiResource('modules',  ModuleController::class);
    Route::apiResource('horaires', HoraireController::class);
    Route::get('/sessions/en-cours', [SessionController::class, 'enCours']);
    Route::apiResource('sessions',   SessionController::class);

    // Étudiants
    Route::post('/etudiants/{id}/photo', [EtudiantController::class, 'uploadPhoto']);
    Route::apiResource('etudiants',      EtudiantController::class);

    // Paiements
    Route::get('/inscriptions/comptes', [InscriptionController::class, 'comptes']);
    Route::apiResource('inscriptions',  InscriptionController::class);
    Route::apiResource('recouvrements', RecouvrementController::class);

    // ── Factures ──
    Route::prefix('factures')->group(function () {
        Route::post('/generate',         [FactureController::class, 'generate']);
        Route::post('/verify',           [FactureController::class, 'verify']);
        Route::post('/print-all',        [FactureController::class, 'printAll']);
        Route::get('/{reference}/print', [FactureController::class, 'print']);
        Route::delete('/{reference}',    [FactureController::class, 'destroy']);
    });

    // Certification
    Route::get('/certifications/montant', [CertificationController::class, 'montant']);
    Route::get('/certifications/comptes', [CertificationController::class, 'comptes']);
    Route::get('/certifications/prix', [CertificationController::class, 'getPrix']);
    Route::get('/certifications/prix/historique', [CertificationController::class, 'getPrixHistorique'])
        ->middleware('permission:certifications.prix.manage');
    Route::post('/certifications/prix', [CertificationController::class, 'setPrix'])
        ->middleware('permission:certifications.prix.manage');
    Route::apiResource('certifications',  CertificationController::class);
    Route::post('/certifications/{id}/valider', [CertificationController::class, 'valider'])
        ->middleware('permission:certifications.valider');


    // État & Échéance
    Route::get('/etat',      [EtatController::class,     'index']);
    Route::get('/echeances', [EcheanceController::class, 'index']);
    Route::get('/echeance',  [EcheanceController::class, 'index']); // alias

    // ── Logistique ──
    Route::get   ('/achats',               [LogistiqueController::class, 'indexAchat']);
    Route::post  ('/achats',               [LogistiqueController::class, 'storeAchat']);
    Route::put   ('/achats/{id}',          [LogistiqueController::class, 'updateAchat']);
    Route::delete('/achats/{id}',          [LogistiqueController::class, 'destroyAchat']);
    Route::post  ('/achats/{id}/photo',    [LogistiqueController::class, 'uploadPhotoAchat']);

    Route::get   ('/charges',              [LogistiqueController::class, 'indexCharge']);
    Route::post  ('/charges',              [LogistiqueController::class, 'storeCharge']);
    Route::put   ('/charges/{id}',         [LogistiqueController::class, 'updateCharge']);
    Route::delete('/charges/{id}',         [LogistiqueController::class, 'destroyCharge']);

    Route::get   ('/autres-depenses',      [LogistiqueController::class, 'indexAutre']);
    Route::post  ('/autres-depenses',      [LogistiqueController::class, 'storeAutre']);
    Route::delete('/autres-depenses/{id}', [LogistiqueController::class, 'destroyAutre']);

    // ── Personnel ──
    Route::post  ('/personnel/{id}/photo', [PersonnelController::class, 'uploadPhoto']);
    Route::get   ('/personnel',            [PersonnelController::class, 'index']);
    Route::post  ('/personnel',            [PersonnelController::class, 'store']);
    Route::get   ('/personnel/{id}',       [PersonnelController::class, 'show']);
    Route::put   ('/personnel/{id}',       [PersonnelController::class, 'update']);
    Route::delete('/personnel/{id}',       [PersonnelController::class, 'destroy']);

    Route::get   ('/fonctions',            [PersonnelController::class, 'indexFonction']);
    Route::post  ('/fonctions',            [PersonnelController::class, 'storeFonction']);
    Route::put   ('/fonctions/{id}',       [PersonnelController::class, 'updateFonction']);
    Route::delete('/fonctions/{id}',       [PersonnelController::class, 'destroyFonction']);


    // ══════════════════════════════════════
    // ── Services — réservé admin (permission dédiée, cohérent avec certifications) ──
    // ══════════════════════════════════════
    Route::middleware('permission:services.access')->group(function () {
        Route::apiResource('clients',  ClientController::class);
        Route::apiResource('services', ServiceController::class);

        Route::get ('/prestations',               [PrestationController::class, 'index']);
        Route::get ('/recouvrements-prestation',  [PrestationController::class, 'indexRecouvrement']);
        Route::get ('/prestations/reste-a-payer', [PrestationController::class, 'resteAPayer']);
        Route::post('/prestations/{type}',        [PrestationController::class, 'store'])
            ->where('type', 'paiement|recouvrement');
        Route::put   ('/prestations/{id}', [PrestationController::class, 'update']);
        Route::delete('/prestations/{id}', [PrestationController::class, 'destroy']);
    });

    // ══════════════════════════════════════
    // ── Gestion des Budgets — réservé admin (permission dédiée) ──
    // ══════════════════════════════════════
    Route::middleware('permission:budgets.access')->group(function () {
        Route::get   ('/comptes-budget',        [CompteController::class, 'index']);
        Route::get   ('/comptes-budget/simple', [CompteController::class, 'simple']);
        Route::post  ('/comptes-budget',        [CompteController::class, 'store']);
        Route::put   ('/comptes-budget/{id}',   [CompteController::class, 'update']);
        Route::delete('/comptes-budget/{id}',   [CompteController::class, 'destroy']);

        Route::get   ('/gerer',      [GererController::class, 'index']);
        Route::post  ('/gerer',      [GererController::class, 'store']);
        Route::put   ('/gerer/{id}', [GererController::class, 'update']);
        Route::delete('/gerer/{id}', [GererController::class, 'destroy']);

        Route::get   ('/transferts',      [TransferController::class, 'index']);
        Route::post  ('/transferts',      [TransferController::class, 'store']);
        Route::delete('/transferts/{id}', [TransferController::class, 'destroy']);
    });

});