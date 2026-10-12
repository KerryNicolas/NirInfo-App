<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Lieux de formation et de paiement : jusqu'ici une liste écrite en dur dans
 * six écrans (Ampandrana, Ampefiloha, Andravoahangy). La table `lieu` devient
 * la source unique, gérée depuis l'onglet « Lieu » de Session.
 *
 * AJOUT UNIQUEMENT : aucune ligne existante n'est modifiée. Les colonnes
 * session.lieu, inscription.lieu_paiement et certificat.lieu_paiement restent
 * du texte ; la table est seulement remplie avec les trois lieux d'origine et
 * avec tout autre lieu déjà présent dans ces colonnes, pour que rien de ce qui
 * a déjà été saisi ne disparaisse des listes.
 */
return new class extends Migration
{
    private const LIEUX_D_ORIGINE = ['Ampandrana', 'Ampefiloha', 'Andravoahangy'];

    public function up(): void
    {
        if (!Schema::hasTable('lieu')) {
            Schema::create('lieu', function (Blueprint $table) {
                // Même interclassement que les tables métier (salarie, session,
                // inscription…) : sans cela, la jointure sur l'éditeur échoue
                // (« Illegal mix of collations »).
                $table->charset   = 'utf8mb4';
                $table->collation = 'utf8mb4_general_ci';

                $table->increments('id_lieu');
                $table->string('nom_lieu', 100)->unique();
                // Éditeur, comme dans horaire et module.
                $table->string('matricule_s')->nullable();
            });
        }

        $noms = collect(self::LIEUX_D_ORIGINE);
        foreach (['session' => 'lieu', 'inscription' => 'lieu_paiement', 'certificat' => 'lieu_paiement'] as $table => $colonne) {
            if (Schema::hasColumn($table, $colonne)) {
                $noms = $noms->merge(DB::table($table)->whereNotNull($colonne)->distinct()->pluck($colonne));
            }
        }

        $dejaLa = DB::table('lieu')->pluck('nom_lieu')->map(fn ($n) => mb_strtolower($n))->all();
        foreach ($noms as $nom) {
            $nom = mb_convert_case(trim(preg_replace('/\s+/', ' ', (string) $nom)), MB_CASE_TITLE);
            if ($nom === '' || mb_strlen($nom) > 100 || in_array(mb_strtolower($nom), $dejaLa, true)) {
                continue;
            }
            DB::table('lieu')->insert(['nom_lieu' => $nom]);
            $dejaLa[] = mb_strtolower($nom);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('lieu');
    }
};
