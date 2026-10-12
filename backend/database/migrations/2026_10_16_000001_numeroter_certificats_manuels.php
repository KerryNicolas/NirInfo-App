<?php

use App\Services\MatriculeEtudiantService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Les certificats saisis à la main reçoivent désormais un matricule de la
 * série NI à leur création. Cette migration rattrape ceux qui ont été
 * enregistrés avant, sans matricule : chacun reçoit le numéro suivant, dans
 * l'ordre de leur création.
 *
 * Seule la colonne certificat.matricule des certificats manuels SANS
 * matricule est renseignée. Aucun étudiant, aucun autre certificat et aucun
 * matricule déjà saisi n'est modifié. Rejouable : un certificat qui a déjà un
 * matricule est ignoré.
 *
 * down() ne fait rien, volontairement : rien ne distingue un matricule
 * attribué ici d'un matricule attribué ensuite par l'application, et en
 * retirer un libérerait un numéro qui pourrait être redonné à quelqu'un
 * d'autre.
 */
return new class extends Migration
{
    public function up(): void
    {
        $service = app(MatriculeEtudiantService::class);

        DB::transaction(function () use ($service) {
            $aNumeroter = DB::table('certificat')
                ->where('origine', 'manuel')
                ->where(fn ($q) => $q->whereNull('matricule')->orWhere('matricule', ''))
                ->orderBy('id')
                ->pluck('id');

            foreach ($aNumeroter as $id) {
                $service->attribuer(
                    fn (string $matricule) => DB::table('certificat')->where('id', $id)->update(['matricule' => $matricule])
                );
            }
        });
    }

    public function down(): void
    {
        // Voir l'en-tête : irréversible par conception.
    }
};
