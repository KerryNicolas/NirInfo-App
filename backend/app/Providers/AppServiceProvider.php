<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Fix longueur clé MySQL sur WAMP
        Schema::defaultStringLength(191);

        // Broker "invitations" pour les liens d'activation de compte.
        //  - table DÉDIÉE account_activation_tokens : un jeton d'activation
        //    n'est jamais accepté par la réinitialisation de mot de passe
        //    (table password_reset_tokens), et inversement ;
        //  - durée lue dans User::ACTIVATION_LINK_HOURS (source unique, 48 h).
        // Déclaré ici pour ne pas avoir à modifier config/auth.php.
        config(['auth.passwords.invitations' => [
            'provider' => 'users',
            'table'    => 'account_activation_tokens',
            'expire'   => User::ACTIVATION_LINK_HOURS * 60, // en minutes
            'throttle' => 0,
        ]]);

        // Lien reset password vers frontend React.
        // FIX : l'adresse n'est plus écrite en dur (http://localhost:5173) —
        // elle vient de config('app.frontend_url'), alimentée par FRONTEND_URL
        // dans .env. Sinon les emails pointeraient vers localhost en production.
        ResetPassword::createUrlUsing(function ($user, string $token) {
            return rtrim(config('app.frontend_url', 'http://localhost:5173'), '/')
                . '/reset-password'
                . '?token=' . $token
                . '&email=' . urlencode($user->email);
        });
    }
}