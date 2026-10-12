<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Série unique des matricules « NI-0001 ». Elle sert aux étudiants ET aux
 * certificats saisis à la main (personnes sans fiche étudiant) : le prochain
 * numéro est donc calculé sur les deux tables, pour qu'un numéro ne soit
 * jamais donné deux fois.
 */
class MatriculeEtudiantService
{
    private const VERROU = 'nirsoft_matricule_ni';

    /** Plus grand numéro déjà attribué, toutes tables confondues. */
    public function dernierNumero(): int
    {
        $etudiants = DB::table('etudiant')
            ->max(DB::raw("CAST(SUBSTRING(matricule_etudiant, 4) AS UNSIGNED)"));

        $manuels = DB::table('certificat')
            ->where('origine', 'manuel')
            ->where('matricule', 'REGEXP', '^NI-[0-9]+$')
            ->max(DB::raw("CAST(SUBSTRING(matricule, 4) AS UNSIGNED)"));

        return max((int) $etudiants, (int) $manuels);
    }

    public function formater(int $numero): string
    {
        return 'NI-' . str_pad((string) $numero, 4, '0', STR_PAD_LEFT);
    }

    /**
     * Calcule le prochain matricule et le passe à $enregistrer, qui doit
     * l'écrire en base. Un verrou MySQL couvre le calcul et l'écriture :
     * deux créations simultanées ne peuvent pas obtenir le même numéro.
     */
    public function attribuer(callable $enregistrer): string
    {
        $obtenu = DB::selectOne('SELECT GET_LOCK(?, 10) AS ok', [self::VERROU])->ok ?? 0;
        if ((int) $obtenu !== 1) {
            throw new RuntimeException("Attribution du matricule indisponible pour l'instant. Réessayez.");
        }

        try {
            $matricule = $this->formater($this->dernierNumero() + 1);
            $enregistrer($matricule);

            return $matricule;
        } finally {
            DB::selectOne('SELECT RELEASE_LOCK(?) AS ok', [self::VERROU]);
        }
    }
}
