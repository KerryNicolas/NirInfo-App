<?php

namespace Tests\Feature;

use App\Mail\AccountActivationMail;
use App\Models\User;
use Tests\TestCase;

// Email d'activation : il part en deux versions (HTML et texte), et le lien
// d'activation doit être utilisable tel quel dans les deux.
class AccountActivationMailTest extends TestCase
{
    private const LIEN = 'https://exemple.test/reset-password?token=abc123&email=jean%40exemple.test&activation=1';

    private function email(): AccountActivationMail
    {
        $compte = (new User())->forceFill(['name' => "Jean D'Arc", 'email' => 'jean@exemple.test']);

        return new AccountActivationMail($compte, self::LIEN, 48);
    }

    public function test_la_version_texte_contient_le_lien_exact(): void
    {
        $email = $this->email();

        // Le lien tel quel : ses « & » ne sont pas transformés en « &amp; ».
        $email->assertSeeInText(self::LIEN, false);
        $email->assertDontSeeInText('&amp;', false);
        $email->assertSeeInText("Bonjour Jean D'Arc,", false);
        $email->assertSeeInText('jean@exemple.test', false);
        $email->assertSeeInText('48 heures', false);
        // Aucune balise dans la version texte.
        $email->assertDontSeeInText('<a ', false);
        $email->assertDontSeeInText('<p', false);
    }

    public function test_la_version_html_est_inchangee(): void
    {
        $email = $this->email();

        $email->assertSeeInHtml('Activer mon compte');
        $email->assertSeeInHtml(self::LIEN);          // échappé par Blade dans le HTML, comme avant
        $email->assertSeeInHtml("Bonjour Jean D'Arc,");
        $email->assertHasSubject("Activez votre compte Nir'Info");
    }
}
