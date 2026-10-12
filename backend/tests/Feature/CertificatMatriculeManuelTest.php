<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\MatriculeEtudiantService;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Un certificat saisi à la main porte toujours un vrai matricule de la série
// NI, partagée avec les étudiants sans jamais donner deux fois le même numéro.
class CertificatMatriculeManuelTest extends TestCase
{
    private int $dernier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->actingAs(User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail());
        $this->dernier = app(MatriculeEtudiantService::class)->dernierNumero();
    }

    private function ni(int $decalage): string
    {
        return 'NI-' . str_pad((string) ($this->dernier + $decalage), 4, '0', STR_PAD_LEFT);
    }

    private function manuel(array $surcharge = []): array
    {
        return array_merge([
            'nom_complet' => 'TEST PHPUNIT Manuel', 'nom_formation' => 'Formation de test',
            'date_debut' => '2099-03-01', 'date_fin' => '2099-03-31', 'lieu_paiement' => 'Ampandrana',
        ], $surcharge);
    }

    private function etudiant(): array
    {
        return ['nom' => 'TESTPHPUNIT', 'prenom' => 'Etudiant', 'sexe' => 'HOMME'];
    }

    public function test_sans_matricule_saisi_le_certificat_recoit_le_numero_suivant(): void
    {
        $reponse = $this->postJson('/api/certifications/manuel', $this->manuel())->assertStatus(201);

        $this->assertSame($this->ni(1), $reponse->json('certificat.matricule'));
        $this->assertSame($this->ni(1), DB::table('certificat')->where('reference', $reponse->json('reference'))->value('matricule'));

        // La liste renvoie ce matricule : l'écran n'a plus à afficher « Saisie manuelle ».
        $ligne = collect($this->getJson('/api/certifications?search=' . $reponse->json('reference'))->json('data'))->first();
        $this->assertSame($this->ni(1), $ligne['matricule']);
        $this->assertSame('TEST PHPUNIT Manuel', $ligne['nom_complet']);
    }

    public function test_etudiants_et_certificats_manuels_ne_partagent_jamais_un_numero(): void
    {
        $c1 = $this->postJson('/api/certifications/manuel', $this->manuel())->assertStatus(201)->json('certificat.matricule');
        $e1 = $this->postJson('/api/etudiants', $this->etudiant())->assertStatus(201)->json('matricule');
        $c2 = $this->postJson('/api/certifications/manuel', $this->manuel(['nom_complet' => 'TEST PHPUNIT Deux']))->assertStatus(201)->json('certificat.matricule');
        $e2 = $this->postJson('/api/etudiants', $this->etudiant())->assertStatus(201)->json('matricule');

        $this->assertSame([$this->ni(1), $this->ni(2), $this->ni(3), $this->ni(4)], [$c1, $e1, $c2, $e2]);
        $this->assertFalse(DB::table('etudiant')->whereIn('matricule_etudiant', [$c1, $c2])->exists());
    }

    public function test_sans_certificat_manuel_les_etudiants_gardent_leur_numerotation(): void
    {
        $avant = (int) DB::table('etudiant')->max(DB::raw('CAST(SUBSTRING(matricule_etudiant, 4) AS UNSIGNED)'));
        // Aucun certificat manuel numéroté au-delà : la suite est celle des étudiants.
        $this->assertGreaterThanOrEqual($avant, $this->dernier);

        $matricule = $this->postJson('/api/etudiants', $this->etudiant())->assertStatus(201)->json('matricule');

        $this->assertSame($this->ni(1), $matricule);
        $this->assertMatchesRegularExpression('/^NI-\d{4,}$/', $matricule);
    }

    public function test_le_matricule_d_un_etudiant_existant_est_accepte_tel_quel(): void
    {
        $etudiant = DB::table('etudiant')->orderBy('matricule_etudiant')->value('matricule_etudiant');

        $reponse = $this->postJson('/api/certifications/manuel', $this->manuel(['matricule' => ' ' . strtolower($etudiant) . ' ']))->assertStatus(201);

        $this->assertSame($etudiant, $reponse->json('certificat.matricule'));
        // La série n'a pas avancé.
        $this->assertSame($this->dernier, app(MatriculeEtudiantService::class)->dernierNumero());
    }

    public function test_un_matricule_invente_est_refuse(): void
    {
        $avant = DB::table('certificat')->count();

        foreach (['NI-999999', 'ANCIEN-12', $this->ni(1)] as $invente) {
            $this->postJson('/api/certifications/manuel', $this->manuel(['matricule' => $invente]))
                ->assertStatus(422)->assertJsonValidationErrors('matricule');
        }

        $this->assertSame($avant, DB::table('certificat')->count());
        $this->assertSame($this->dernier, app(MatriculeEtudiantService::class)->dernierNumero());
    }

    public function test_modifier_un_certificat_manuel_ne_lui_fait_pas_perdre_son_matricule(): void
    {
        $reference = $this->postJson('/api/certifications/manuel', $this->manuel())->assertStatus(201)->json('reference');

        // Champ vidé à la modification : le matricule reste.
        $this->putJson("/api/certifications/{$reference}", $this->manuel(['nom_complet' => 'TEST PHPUNIT Corrigé', 'matricule' => '']))->assertOk();
        $c = DB::table('certificat')->where('reference', $reference)->first();
        $this->assertSame($this->ni(1), $c->matricule);
        $this->assertSame('TEST PHPUNIT Corrigé', $c->nom_manuel);

        // Même matricule renvoyé par le formulaire : accepté, sans nouveau numéro.
        $this->putJson("/api/certifications/{$reference}", $this->manuel(['matricule' => $this->ni(1)]))->assertOk();
        $this->assertSame($this->ni(1), DB::table('certificat')->where('reference', $reference)->value('matricule'));
        $this->assertSame($this->dernier + 1, app(MatriculeEtudiantService::class)->dernierNumero());

        // Un matricule inventé reste refusé à la modification.
        $this->putJson("/api/certifications/{$reference}", $this->manuel(['matricule' => 'NI-999999']))->assertStatus(422);
        $this->assertSame($this->ni(1), DB::table('certificat')->where('reference', $reference)->value('matricule'));
    }

    public function test_la_migration_numerote_les_anciens_certificats_manuels_dans_l_ordre(): void
    {
        // État d'avant : tout certificat manuel sans matricule présent en base,
        // plus deux anciens ajoutés pour le test.
        $dejaSans = DB::table('certificat')->where('origine', 'manuel')
            ->where(fn ($q) => $q->whereNull('matricule')->orWhere('matricule', ''))->orderBy('id')->pluck('id')->all();
        $ids = $dejaSans;
        foreach (['TEST-PHPUNIT-M1' => null, 'TEST-PHPUNIT-M2' => ''] as $reference => $matricule) {
            $ids[] = DB::table('certificat')->insertGetId([
                'reference' => $reference, 'matricule' => $matricule, 'debut_session' => '2099-03-01', 'fin_session' => '2099-03-31',
                'accept' => 0, 'origine' => 'manuel', 'nom_manuel' => 'TEST PHPUNIT Ancien',
            ]);
        }
        $dejaNumerote = DB::table('certificat')->insertGetId([
            'reference' => 'TEST-PHPUNIT-M3', 'matricule' => 'NI-0001', 'debut_session' => '2099-03-01', 'fin_session' => '2099-03-31',
            'accept' => 0, 'origine' => 'manuel', 'nom_manuel' => 'TEST PHPUNIT Déjà numéroté',
        ]);
        $etudiants = DB::table('etudiant')->count();
        $normaux   = DB::table('certificat')->where('origine', '!=', 'manuel')->orderBy('id')->pluck('matricule', 'id')->all();

        $migration = require database_path('migrations/2026_10_16_000001_numeroter_certificats_manuels.php');
        $migration->up();

        $attendus = [];
        foreach ($ids as $i => $id) {
            $attendus[$id] = $this->ni($i + 1);
        }
        $this->assertSame($attendus, DB::table('certificat')->whereIn('id', $ids)->orderBy('id')->pluck('matricule', 'id')->all());
        $this->assertSame('NI-0001', DB::table('certificat')->where('id', $dejaNumerote)->value('matricule'));
        $this->assertSame($etudiants, DB::table('etudiant')->count());
        $this->assertSame($normaux, DB::table('certificat')->where('origine', '!=', 'manuel')->orderBy('id')->pluck('matricule', 'id')->all());

        // Rejouée : plus rien à numéroter, rien ne change.
        $migration->up();
        $this->assertSame($attendus, DB::table('certificat')->whereIn('id', $ids)->orderBy('id')->pluck('matricule', 'id')->all());
    }
}
