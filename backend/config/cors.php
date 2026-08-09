<?php
return [
    'paths'                => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods'      => ['*'],
    'allowed_origins'      => ['http://localhost:5173', 'http://localhost:5174'],
    'allowed_origins_patterns' => [],
    'allowed_headers'      => ['*'],
    'exposed_headers'      => [],
    'max_age'              => 0,
    // FIX : doit être true — indispensable pour que le navigateur envoie/accepte
    // le cookie de session cross-port (localhost:5173 -> localhost:8000).
    // Avec 'false', withCredentials:true côté frontend est ignoré par le navigateur.
    'supports_credentials' => true,
];