<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Liste des « autres dépenses » : elle répondait en erreur 500, le code
// triant sur une colonne `id` qui n'existe pas (la clé est id_autre).
class AutresDepensesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAs(User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail());
    }

    public function test_la_liste_repond_et_commence_par_la_plus_recente(): void
    {
        $liste = $this->getJson('/api/autres-depenses?per_page=5')->assertOk()->json();

        $this->assertSame(DB::table('autre_depense')->count(), $liste['total']);
        $attendus = DB::table('autre_depense')->orderByDesc('id_autre')->limit(5)->pluck('id_autre')->all();
        $this->assertSame($attendus, array_column($liste['data'], 'id_autre'));
    }

    public function test_la_recherche_et_le_tri_fonctionnent(): void
    {
        $une = DB::table('autre_depense')->orderByDesc('id_autre')->first();
        $this->assertNotNull($une, 'La base de test doit contenir au moins une autre dépense.');

        $trouves = $this->getJson('/api/autres-depenses?per_page=200&search=' . urlencode($une->designation))->assertOk()->json();
        $this->assertContains($une->id_autre, array_column($trouves['data'], 'id_autre'));
        $this->assertSame(DB::table('autre_depense')->where('designation', 'like', '%' . $une->designation . '%')->count(), $trouves['total']);

        $croissant = $this->getJson('/api/autres-depenses?per_page=3&sort=id_autre&sort_dir=asc')->assertOk()->json('data');
        $this->assertSame(DB::table('autre_depense')->orderBy('id_autre')->limit(3)->pluck('id_autre')->all(), array_column($croissant, 'id_autre'));
    }
}
