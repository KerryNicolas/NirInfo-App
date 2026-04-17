<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('horaire', function (Blueprint $table) {
            $table->string('code_horaire', 10)->primary();
            $table->string('designation', 100);
            $table->string('horaire', 191)->nullable();
            $table->text('remarque')->nullable();
            $table->string('matricule_s', 20)->nullable(); // éditeur
            $table->timestamps();
        });

        // Insérer les horaires par défaut
        DB::table('horaire')->insert([
            ['code_horaire' => 'MAT', 'designation' => 'Matin',          'horaire' => 'Lundi–Vendredi 07h30–12h00', 'remarque' => null, 'matricule_s' => null],
            ['code_horaire' => 'APM', 'designation' => 'Après-midi',     'horaire' => 'Lundi–Vendredi 13h00–17h30', 'remarque' => null, 'matricule_s' => null],
            ['code_horaire' => 'SS',  'designation' => 'Soir semaine',   'horaire' => 'Lundi–Vendredi 18h00–21h00', 'remarque' => null, 'matricule_s' => null],
            ['code_horaire' => 'WE',  'designation' => 'Week-end matin', 'horaire' => 'Sam–Dim 08h00–12h00',        'remarque' => null, 'matricule_s' => null],
            ['code_horaire' => 'WES', 'designation' => 'Week-end soir',  'horaire' => 'Sam–Dim 13h00–17h00',        'remarque' => null, 'matricule_s' => null],
            ['code_horaire' => 'INT', 'designation' => 'Intensif',       'horaire' => 'Tous les jours 08h00–17h00', 'remarque' => null, 'matricule_s' => null],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('horaire');
    }
};