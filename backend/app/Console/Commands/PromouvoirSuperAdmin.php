<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

// Seul moyen de désigner l'administrateur principal : ni l'interface ni l'API
// ne peuvent attribuer ce rôle. À lancer à la main, sur chaque environnement.
//
// Rien n'est écrit avant que le récapitulatif (compte, base, serveur,
// environnement) soit affiché, y compris avec --force. Sans --force, il faut
// répondre à la question ; sans terminal pour y répondre, la commande refuse.
class PromouvoirSuperAdmin extends Command
{
    public const QUESTION = 'Confirmer la promotion de ce compte en administrateur principal ?';

    protected $signature = 'app:promouvoir-super-admin {email : Adresse email du compte à promouvoir} {--force : Ne pas demander de confirmation (le récapitulatif reste affiché)}';

    protected $description = "Donne à un compte existant le rôle d'administrateur principal (super-admin)";

    public function handle(): int
    {
        // La colonne email est unique, mais on ne s'y fie pas : une adresse
        // qui désignerait plusieurs comptes est refusée.
        $comptes = User::where('email', $this->argument('email'))->get();
        if ($comptes->isEmpty()) {
            return $this->refus('Aucun compte ne porte cette adresse email.');
        }
        if ($comptes->count() > 1) {
            return $this->refus("Cette adresse désigne {$comptes->count()} comptes : promotion impossible.");
        }
        $user = $comptes->first();

        $connexion = $user->getConnection();
        $this->line('Récapitulatif avant écriture');
        $this->line('  Compte        : ' . $user->name . ' <' . $user->email . '>');
        $this->line('  Rôle actuel   : ' . ($user->roleRelation?->slug ?? 'aucun'));
        $this->line('  Activation    : ' . ($user->isActivated() ? 'compte activé' : 'compte NON activé'));
        $this->line('  Base          : ' . $connexion->getDatabaseName());
        $this->line('  Serveur       : ' . $connexion->getConfig('host') . ':' . $connexion->getConfig('port'));
        $this->line('  Environnement : ' . $this->laravel->environment());

        $role = Role::where('slug', User::ROLE_SUPER_ADMIN)->first();
        if (!$role) {
            return $this->refus("Le rôle super-admin n'existe pas sur cette base : lancez d'abord la migration.");
        }

        // Même critère que la connexion : activated_at rempli (User::isActivated).
        if (!$user->isActivated()) {
            return $this->refus("Ce compte n'est pas activé : son titulaire n'a pas encore défini son mot de passe.");
        }

        if ($user->isSuperAdmin()) {
            $this->info("{$user->name} est déjà administrateur principal : aucun compte modifié.");
            return self::SUCCESS;
        }

        if (!$this->option('force')) {
            if (!$this->input->isInteractive()) {
                return $this->refus('Confirmation impossible sans terminal interactif. Relancez dans un terminal, ou avec --force après avoir lu le récapitulatif.');
            }
            if (!$this->confirm(self::QUESTION)) {
                $this->line('Annulé : aucun compte modifié.');
                return self::FAILURE;
            }
        }

        $ancienRole = $user->roleRelation?->slug;
        $user->role_id = $role->id;
        $user->save();

        Log::info('Compte promu administrateur principal', ['user_id' => $user->id, 'ancien_role' => $ancienRole]);
        $this->info("{$user->name} est maintenant administrateur principal.");

        return self::SUCCESS;
    }

    private function refus(string $message): int
    {
        $this->error($message . ' Aucun compte modifié.');

        return self::FAILURE;
    }
}
