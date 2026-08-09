<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Etudiant ──
        Schema::table('etudiant', function (Blueprint $table) {
            $table->index(['nom_etudiant', 'prenom_etudiant'], 'idx_etudiant_nom');
            $table->index('date_inscription', 'idx_etudiant_date');
        });

        // ── Inscription (= table paiement dans ta BD) ──
        Schema::table('inscription', function (Blueprint $table) {
            $table->index('matricule_etudiant', 'idx_inscription_etudiant');
            $table->index('code_session',       'idx_inscription_session');
            $table->index('date_paiement',      'idx_inscription_date');
        });

        // ── Personnel ──
        Schema::table('personnel', function (Blueprint $table) {
            $table->index(['nom_pers', 'prenom_pers'], 'idx_personnel_nom');
            $table->index('id_fonction',               'idx_personnel_fonction');
        });
    }

    public function down(): void
    {
        Schema::table('etudiant',    fn($t) => $t->dropIndex('idx_etudiant_nom'));
        Schema::table('etudiant',    fn($t) => $t->dropIndex('idx_etudiant_date'));
        Schema::table('inscription', fn($t) => $t->dropIndex('idx_inscription_etudiant'));
        Schema::table('inscription', fn($t) => $t->dropIndex('idx_inscription_session'));
        Schema::table('inscription', fn($t) => $t->dropIndex('idx_inscription_date'));
        Schema::table('personnel',   fn($t) => $t->dropIndex('idx_personnel_nom'));
        Schema::table('personnel',   fn($t) => $t->dropIndex('idx_personnel_fonction'));
    }
};