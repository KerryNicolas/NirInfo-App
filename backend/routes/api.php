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

// Routes publiques — sans rate limit
Route::withoutMiddleware('throttle:api')->group(function () {
    Route::post('/login',           [AuthController::class, 'login']);
    Route::post('/register',        [AuthController::class, 'register']);
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('/reset-password',  [AuthController::class, 'resetPassword']);
});

// Routes protégées
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user',    [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    Route::get('/dashboard/stats', [DashboardController::class, 'stats']);

    Route::apiResource('modules',       ModuleController::class);
    Route::apiResource('sessions',      SessionController::class);
    Route::apiResource('horaires',      HoraireController::class);
    Route::apiResource('etudiants',     EtudiantController::class);
    Route::apiResource('inscriptions',  InscriptionController::class);
    Route::apiResource('recouvrements', RecouvrementController::class);

    Route::get('/sessions/en-cours',         [SessionController::class, 'enCours']);
    Route::post('/etudiants/{id}/photo',     [EtudiantController::class, 'uploadPhoto']);
    Route::post('/factures/generate',        [FactureController::class, 'generate']);
});