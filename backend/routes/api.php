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

// ── Routes publiques ──
Route::withoutMiddleware('throttle:api')->group(function () {
    Route::post('/login',           [AuthController::class, 'login']);
    Route::post('/register',        [AuthController::class, 'register']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password',  [AuthController::class, 'resetPassword']);
});

// ── Routes protégées ──
Route::middleware('auth:sanctum')->group(function () {

    // Auth
    Route::get ('/user',    [AuthController::class, 'me']);
    Route::post('/logout',  [AuthController::class, 'logout']);
    Route::put ('/profile', [AuthController::class, 'updateProfile']);

    // Dashboard
    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);
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
    Route::apiResource('inscriptions',  InscriptionController::class);
    Route::apiResource('recouvrements', RecouvrementController::class);

    // Facture & Certification
    Route::post('/factures/generate',     [FactureController::class,       'generate']);
    Route::get('/certifications/montant', [CertificationController::class, 'montant']);
    Route::apiResource('certifications',  CertificationController::class);

    // État & Échéance
    Route::get('/etat',      [EtatController::class,     'index']);
    Route::get('/echeances', [EcheanceController::class, 'index']);
    Route::get('/echeance',  [EcheanceController::class, 'index']); // alias

    // ── LOGISTIQUE ──
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

    // ── PERSONNEL ──
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
});