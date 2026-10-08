<?php

// Fichier obligatoire sous Laravel 10 : sans lui, config('mail.default') vaut
// null et tout envoi d'email plante (activation de compte, mot de passe
// oublié), quelles que soient les variables MAIL_* du .env.
return [
    'default' => env('MAIL_MAILER', 'smtp'),

    'mailers' => [
        'smtp' => [
            'transport'    => 'smtp',
            'url'          => env('MAIL_URL'),
            'host'         => env('MAIL_HOST', 'smtp.mailgun.org'),
            'port'         => env('MAIL_PORT', 587),
            'encryption'   => env('MAIL_ENCRYPTION', 'tls'),
            'username'     => env('MAIL_USERNAME'),
            'password'     => env('MAIL_PASSWORD'),
            'timeout'      => null,
            'local_domain' => env('MAIL_EHLO_DOMAIN'),
        ],

        // MAIL_MAILER=log : écrit l'email dans storage/logs au lieu de l'envoyer.
        'log' => [
            'transport' => 'log',
            'channel'   => env('MAIL_LOG_CHANNEL'),
        ],

        'array' => [
            'transport' => 'array',
        ],
    ],

    // Expéditeur par défaut : même adresse que celle imprimée sur les factures.
    'from' => [
        'address' => env('MAIL_FROM_ADDRESS', 'admin@nir-info.mg'),
        'name'    => env('MAIL_FROM_NAME', env('APP_NAME', "Nir'Info")),
    ],
];
