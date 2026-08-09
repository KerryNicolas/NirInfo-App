<?php
return [
    'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
        '%s%s',
        'localhost,localhost:3000,localhost:5173,127.0.0.1,127.0.0.1:8000,::1',
        env('APP_URL') ? ','.parse_url(env('APP_URL'), PHP_URL_HOST) : ''
    ))),
    'guard' => ['web'],
    // Inchangé volontairement : cette valeur ne s'applique qu'aux tokens Bearer
    // (createToken), qu'on n'utilise plus depuis le passage à l'auth par session.
    // La vraie durée de session se règle via SESSION_LIFETIME dans .env.
    'expiration' => null,
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),
    'middleware' => [
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies'      => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'verify_csrf_token'    => Illuminate\Foundation\Http\Middleware\VerifyCsrfToken::class,
    ],
];