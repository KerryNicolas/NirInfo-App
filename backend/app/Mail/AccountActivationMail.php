<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Email envoyé à un nouvel utilisateur quand un administrateur crée son compte.
 * Contient le lien d'activation à usage unique (aucun mot de passe).
 *
 * Emplacement : app/Mail/AccountActivationMail.php
 * Vues associées : resources/views/emails/account-activation.blade.php (HTML)
 *                  resources/views/emails/account-activation-text.blade.php (texte)
 */
class AccountActivationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public string $activationUrl,
        public int $expiresInHours,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Activez votre compte Nir'Info",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.account-activation',
            // Version texte : un email en HTML seul est plus souvent classé en indésirable.
            text: 'emails.account-activation-text',
        );
    }
}