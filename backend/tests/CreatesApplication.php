<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;
use RuntimeException;

trait CreatesApplication
{
    public function createApplication(): Application
    {
        $app = require __DIR__ . '/../bootstrap/app.php';

        $app->make(Kernel::class)->bootstrap();

        // GARDE-FOU : les tests écrivent en base (dans une transaction annulée
        // à la fin). On refuse de démarrer si la base configurée n'est pas une
        // base de test — vérifié AVANT toute requête SQL.
        $database = (string) $app['config']->get('database.connections.mysql.database');
        if (!str_ends_with($database, '_test')) {
            throw new RuntimeException(
                "Tests refusés : la base configurée est « {$database} ». Seule une base dont le nom finit par « _test » est acceptée."
            );
        }

        return $app;
    }
}
