<?php

namespace App\Providers;

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

        // Lien reset password vers frontend React
        ResetPassword::createUrlUsing(function ($user, string $token) {
            return 'http://localhost:5173/reset-password'
                . '?token=' . $token
                . '&email=' . urlencode($user->email);
        });
    }
}