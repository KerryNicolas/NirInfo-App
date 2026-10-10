<?php

namespace Tests;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    // DatabaseTransactions : chaque test tourne dans une transaction SQL
    // annulée à la fin — la base de test retrouve son état de départ.
    use CreatesApplication, DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        // Second contrôle, sur la connexion RÉELLE cette fois (le premier,
        // dans CreatesApplication, porte sur la configuration).
        $database = (string) DB::connection()->getDatabaseName();
        if (!str_ends_with($database, '_test')) {
            $this->fail("Tests refusés : connecté à « {$database} », qui n'est pas une base de test.");
        }
    }
}
