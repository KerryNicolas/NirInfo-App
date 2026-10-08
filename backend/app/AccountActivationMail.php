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
 * Vue associée : resources/views/emails/account-activation.blade.php
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
        );
    }
}