<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Durée de validité d'un lien d'activation, en heures.
     * SOURCE UNIQUE : utilisée par AppServiceProvider (expiration du jeton)
     * et par AuthController (durée annoncée dans l'email). Pour changer la
     * durée, on ne modifie que cette ligne.
     */
    public const ACTIVATION_LINK_HOURS = 48;

    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'role',
        'role_id',
        'matricule',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'activated_at'      => 'datetime',
        'password'          => 'hashed',
    ];

    public function roleRelation()
    {
        return $this->belongsTo(\App\Models\Role::class, 'role_id');
    }

    /**
     * Administrateur principal : seul rôle autorisé à gérer les modules. Il
     * ne s'attribue ni par l'interface ni par l'API (createUser le refuse),
     * uniquement par la commande app:promouvoir-super-admin.
     */
    public const ROLE_SUPER_ADMIN = 'super-admin';

    public function isSuperAdmin(): bool
    {
        return $this->roleRelation?->slug === self::ROLE_SUPER_ADMIN;
    }

    /** Administrateur au sens large : admin secondaire OU administrateur principal. */
    public function isAdmin(): bool
    {
        return in_array($this->roleRelation?->slug, ['admin', self::ROLE_SUPER_ADMIN], true);
    }

    public function hasPermission(string $slug): bool
    {
        // L'administrateur principal a toutes les permissions par construction :
        // une permission ajoutée plus tard au seul rôle admin ne peut pas lui manquer.
        if ($this->isSuperAdmin()) {
            return true;
        }

        return $this->roleRelation?->permissions()->where('slug', $slug)->exists() ?? false;
    }

    /**
     * Compte activé = l'utilisateur a utilisé son lien d'activation et défini
     * son mot de passe (activated_at rempli). Sinon le compte est "en attente".
     */
    public function isActivated(): bool
    {
        return $this->activated_at !== null;
    }
}