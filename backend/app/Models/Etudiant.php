<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Modèle Eloquent minimal pour la table etudiant.
 * Pas besoin de migration — la table existe déjà.
 * On déclare juste la table et les colonnes fillables.
 */
class Etudiant extends Model
{
    protected $table      = 'etudiant';
    protected $primaryKey = 'matricule_etudiant';
    public    $keyType    = 'string';
    public    $incrementing = false;
    public    $timestamps   = false;

    protected $fillable = [
        'matricule_etudiant','nom_etudiant','prenom_etudiant','sexe',
        'dn_etudiant','ln_etudiant','cin_etudiant','dcin_etudiant',
        'lcin_etudiant','tel_etudiant','mail_etudiant','photo_etudiant',
        'matricule_s',
    ];

    /* ── Accesseur photo URL ── */
    public function getPhotoUrlAttribute(): ?string
    {
        return $this->photo_etudiant
            ? url('storage/photos/' . $this->photo_etudiant)
            : null;
    }

    /* ── Relation salarié (éditeur) ── */
    public function salarie()
    {
        return $this->belongsTo(Salarie::class, 'matricule_s', 'matricule_s');
    }
}