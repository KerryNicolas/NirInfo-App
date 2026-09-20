<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Support\Facades\DB;

// FIX : numérotation de facture centralisée en un seul endroit.
// Avant, InscriptionController et FactureController avaient chacun leur
// propre copie de generateNumero() — légèrement différentes :
// - FactureController ne repartait JAMAIS à "-0001" au changement d'année
//   (il incrémentait éternellement la séquence de la dernière facture,
//   quelle que soit son année) ;
// - InscriptionController avait la bonne vérification d'année, mais sa
//   propre copie du code pouvait diverger de celle de FactureController
//   à la moindre modification future de l'une des deux.
// Résultat : une facture générée automatiquement après une inscription et
// une facture générée manuellement depuis le module Facture pouvaient, à
// terme, ne plus suivre la même numérotation. Ce trait est maintenant
// l'unique source de vérité, utilisée par les deux contrôleurs.
trait GeneratesFactureNumero
{
    protected function generateNumeroFacture(): string
    {
        $last = DB::table('facture')
            ->whereNotNull('numero_facture')
            ->where('numero_facture', '!=', '')
            ->orderByDesc('ref_facture')
            ->first();

        if ($last && !empty($last->numero_facture) && str_contains($last->numero_facture, '-')) {
            [$year, $seq] = explode('-', $last->numero_facture);
            if ($year == date('Y')) {
                return $year . '-' . str_pad((int) $seq + 1, 4, '0', STR_PAD_LEFT);
            }
        }

        return date('Y') . '-0001';
    }
}