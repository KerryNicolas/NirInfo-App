<?php

// FIX : les origines autorisées ne sont plus limitées à localhost. On garde
// les adresses locales de développement et on y ajoute :
//  - FRONTEND_URL          : l'adresse du frontend (déjà utilisée pour les liens des emails) ;
//  - CORS_ALLOWED_ORIGINS  : d'autres adresses éventuelles, séparées par des virgules.
// En production il suffit donc de renseigner FRONTEND_URL dans le .env.
$origins = array_merge(
    ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'],
    [env('FRONTEND_URL')],
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))
);

return [
    'paths'                => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods'      => ['*'],
    'allowed_origins'      => array_values(array_unique(array_filter(
        array_map(fn ($o) => rtrim(trim((string) $o), '/'), $origins)
    ))),
    'allowed_origins_patterns' => [],
    'allowed_headers'      => ['*'],
    'exposed_headers'      => [],
    'max_age'              => 0,
    // FIX : doit être true — indispensable pour que le navigateur envoie/accepte
    // le cookie de session cross-port (localhost:5173 -> localhost:8000).
    // Avec 'false', withCredentials:true côté frontend est ignoré par le navigateur.
    'supports_credentials' => true,
];
