<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Tests\TestCase;

// La suppression est réservée à l'admin : un utilisateur simple reçoit 403
// sur toute requête DELETE, sans perdre l'accès en lecture.
class AdminOnlyDeleteTest extends TestCase
{
    private function admin(): User
    {
        return User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();
    }

    /** Compte simple de test (annulé à la fin, comme tout le reste). */
    private function utilisateurSimple(): User
    {
        $simple = $this->admin()->replicate();
        $simple->email     = 'phpunit-simple@test.local';
        $simple->matricule = 'TEST-PHPUNIT-SIMPLE';
        $simple->role      = 'gestionnaire';
        $simple->role_id   = Role::where('slug', 'user')->firstOrFail()->id;
        $simple->save();

        return $simple;
    }

    public function test_un_utilisateur_simple_ne_peut_pas_supprimer(): void
    {
        $this->actingAs($this->utilisateurSimple());

        foreach (['/api/modules/INEXISTANT', '/api/etudiants/INEXISTANT', '/api/personnel/INEXISTANT', '/api/achats/0'] as $url) {
            $this->deleteJson($url)->assertStatus(403);
        }
    }

    public function test_un_utilisateur_simple_garde_la_lecture(): void
    {
        $this->actingAs($this->utilisateurSimple());

        $this->getJson('/api/modules')->assertOk();
    }

    public function test_l_admin_peut_toujours_supprimer(): void
    {
        $this->actingAs($this->admin());

        $this->assertNotSame(403, $this->deleteJson('/api/modules/INEXISTANT')->getStatusCode());
    }
}
