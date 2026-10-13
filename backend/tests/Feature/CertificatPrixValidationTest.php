<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Prix d'un certificat et « Modifier prix » :
//  - en attente sans prix particulier, le certificat suit le prix standard
//    en vigueur, jusqu'à sa validation ;
//  - un prix saisi à la main est conservé ;
//  - un certificat validé garde son prix, quoi que devienne le prix standard.
// Et validation d'un certificat saisi à la main : payante ou gratuite.
class CertificatPrixValidationTest extends TestCase
{
    private const STANDARD = 12345;
    private const NOUVEAU  = 23456;

    private int $compte;

    protected function setUp(): void
    {
        parent::setUp();

        $this->actingAs(User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail());
        $this->compte = (int) DB::table('compte')->value('id_compte');
        $this->prixStandard(self::STANDARD);
    }

    private function prixStandard(int $prix): void
    {
        $this->postJson('/api/certifications/prix', ['prix' => $prix])->assertOk();
    }

    /** Certificat normal en attente ; renvoie sa référence. */
    private function normal(array $surcharge = []): string
    {
        return $this->postJson('/api/certifications', array_merge([
            'matricule'    => DB::table('etudiant')->orderBy('matricule_etudiant')->value('matricule_etudiant'),
            'code_module'  => DB::table('module')->value('code_module'),
            'code_session' => DB::table('session')->value('code_session'),
            'date_debut'   => '2099-06-01',
            'date_fin'     => '2099-06-30',
        ], $surcharge))->assertStatus(201)->json('reference');
    }

    /** Certificat manuel en attente ; renvoie la réponse du serveur. */
    private function manuel(): array
    {
        return $this->postJson('/api/certifications/manuel', [
            'nom_complet' => 'TEST PHPUNIT Prix', 'nom_formation' => 'Formation de test',
            'date_debut' => '2099-06-01', 'date_fin' => '2099-06-30', 'lieu_paiement' => 'Ampandrana',
        ])->assertStatus(201)->json();
    }

    private function ligne(string $reference): array
    {
        return collect($this->getJson('/api/certifications?search=' . $reference)->assertOk()->json('data'))
            ->firstWhere('reference', $reference);
    }

    private function enBase(string $reference): object
    {
        return DB::table('certificat')->where('reference', $reference)->first();
    }

    private function solde(): float
    {
        return (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant');
    }

    public function test_un_certificat_en_attente_suit_le_prix_standard(): void
    {
        $reference = $this->normal();

        $this->assertNull($this->enBase($reference)->prix);
        $this->assertEqualsWithDelta(self::STANDARD, (float) $this->ligne($reference)['prix'], 0.001);
        $this->assertSame(0, (int) $this->ligne($reference)['prix_particulier']);

        $this->prixStandard(self::NOUVEAU);

        $this->assertEqualsWithDelta(self::NOUVEAU, (float) $this->ligne($reference)['prix'], 0.001);
        $this->assertNull($this->enBase($reference)->prix);
    }

    public function test_un_prix_saisi_a_la_main_est_conserve(): void
    {
        $reference = $this->normal(['prix' => 20000]);

        $this->prixStandard(self::NOUVEAU);

        $this->assertEqualsWithDelta(20000, (float) $this->ligne($reference)['prix'], 0.001);
        $this->assertSame(1, (int) $this->ligne($reference)['prix_particulier']);

        // Validé sans prix dans la requête : c'est le prix particulier qui est encaissé.
        $avant = $this->solde();
        $this->postJson("/api/certifications/{$reference}/valider", ['id_compte' => $this->compte])->assertOk();
        $this->assertEqualsWithDelta(20000, (float) $this->enBase($reference)->prix, 0.001);
        $this->assertEqualsWithDelta($avant + 20000, $this->solde(), 0.001);
    }

    public function test_la_validation_encaisse_le_prix_standard_du_moment(): void
    {
        $reference = $this->normal();
        $this->prixStandard(self::NOUVEAU);
        $avant = $this->solde();

        $this->postJson("/api/certifications/{$reference}/valider", ['id_compte' => $this->compte])->assertOk();

        $certificat = $this->enBase($reference);
        $this->assertSame(1, (int) $certificat->accept);
        $this->assertEqualsWithDelta(self::NOUVEAU, (float) $certificat->prix, 0.001);
        $this->assertEqualsWithDelta(self::NOUVEAU, (float) DB::table('transaction')->where('id_transaction', $certificat->id_transaction)->value('amount'), 0.001);
        $this->assertEqualsWithDelta($avant + self::NOUVEAU, $this->solde(), 0.001);
    }

    public function test_le_prix_corrige_dans_la_fenetre_de_validation_l_emporte(): void
    {
        $reference = $this->normal();
        $avant = $this->solde();

        $this->postJson("/api/certifications/{$reference}/valider", ['id_compte' => $this->compte, 'prix' => 30000])->assertOk();

        $this->assertEqualsWithDelta(30000, (float) $this->enBase($reference)->prix, 0.001);
        $this->assertEqualsWithDelta($avant + 30000, $this->solde(), 0.001);
    }

    public function test_un_certificat_valide_garde_son_prix_quand_le_prix_standard_change(): void
    {
        $reference = $this->normal();
        $this->postJson("/api/certifications/{$reference}/valider", ['id_compte' => $this->compte])->assertOk();
        $transaction = $this->enBase($reference)->id_transaction;
        $solde = $this->solde();

        $this->prixStandard(self::NOUVEAU);

        $this->assertEqualsWithDelta(self::STANDARD, (float) $this->enBase($reference)->prix, 0.001);
        $this->assertEqualsWithDelta(self::STANDARD, (float) $this->ligne($reference)['prix'], 0.001);
        $this->assertSame(1, (int) $this->ligne($reference)['prix_particulier']);
        $this->assertEqualsWithDelta(self::STANDARD, (float) DB::table('transaction')->where('id_transaction', $transaction)->value('amount'), 0.001);
        $this->assertEqualsWithDelta($solde, $this->solde(), 0.001);
    }

    public function test_les_certificats_existants_ne_sont_pas_modifies_par_un_changement_de_prix(): void
    {
        $avant = DB::table('certificat')->orderBy('id')->get(['id', 'prix', 'accept', 'id_transaction'])->toJson();

        $this->prixStandard(self::NOUVEAU);

        $this->assertSame($avant, DB::table('certificat')->orderBy('id')->get(['id', 'prix', 'accept', 'id_transaction'])->toJson());
    }

    public function test_modifier_un_certificat_en_attente_fixe_ou_retire_son_prix_particulier(): void
    {
        $reference = $this->normal();
        $champs = [
            'matricule'    => $this->enBase($reference)->matricule,
            'code_module'  => $this->enBase($reference)->code_module,
            'code_session' => $this->enBase($reference)->code_session,
            'date_debut'   => '2099-06-01',
            'date_fin'     => '2099-06-30',
        ];

        // Prix laissé vide : le certificat continue de suivre le prix standard.
        $this->putJson("/api/certifications/{$reference}", $champs + ['prix' => ''])->assertOk();
        $this->assertNull($this->enBase($reference)->prix);

        $this->putJson("/api/certifications/{$reference}", $champs + ['prix' => 18000])->assertOk();
        $this->assertEqualsWithDelta(18000, (float) $this->enBase($reference)->prix, 0.001);
        $this->assertSame(1, (int) $this->ligne($reference)['prix_particulier']);

        // Prix vidé : retour au prix standard.
        $this->putJson("/api/certifications/{$reference}", $champs + ['prix' => ''])->assertOk();
        $this->assertNull($this->enBase($reference)->prix);
        $this->assertEqualsWithDelta(self::STANDARD, (float) $this->ligne($reference)['prix'], 0.001);
    }

    public function test_un_certificat_manuel_suit_le_prix_standard_puis_se_valide_en_payant(): void
    {
        $reponse   = $this->manuel();
        $reference = $reponse['reference'];

        // La réponse sert tout de suite à la fenêtre de validation.
        $this->assertEqualsWithDelta(self::STANDARD, (float) $reponse['certificat']['prix'], 0.001);
        $this->assertSame(0, (int) $reponse['certificat']['prix_particulier']);
        $this->assertNull($this->enBase($reference)->prix);

        $this->prixStandard(self::NOUVEAU);
        $this->assertEqualsWithDelta(self::NOUVEAU, (float) $this->ligne($reference)['prix'], 0.001);

        $avant = $this->solde();
        $this->postJson("/api/certifications/{$reference}/valider", ['id_compte' => $this->compte, 'prix' => self::NOUVEAU])->assertOk();

        $certificat = $this->enBase($reference);
        $this->assertSame(1, (int) $certificat->accept);
        $this->assertEqualsWithDelta(self::NOUVEAU, (float) $certificat->prix, 0.001);
        $this->assertNotNull($certificat->id_transaction);
        $this->assertEqualsWithDelta($avant + self::NOUVEAU, $this->solde(), 0.001);

        // Corriger ensuite la saisie ne touche ni au prix ni au statut.
        $this->putJson("/api/certifications/{$reference}", [
            'nom_complet' => 'TEST PHPUNIT Prix Corrige', 'nom_formation' => 'Formation de test',
            'date_debut' => '2099-06-01', 'date_fin' => '2099-06-30',
        ])->assertOk();
        $this->assertEqualsWithDelta(self::NOUVEAU, (float) $this->enBase($reference)->prix, 0.001);
        $this->assertSame(1, (int) $this->enBase($reference)->accept);
    }

    public function test_un_certificat_manuel_se_valide_gratuitement_avec_un_motif(): void
    {
        $reference = $this->manuel()['reference'];
        $avant = $this->solde();
        $transactions = DB::table('transaction')->count();

        // Sans motif : refusé, le certificat reste en attente.
        $this->postJson("/api/certifications/{$reference}/valider", ['gratuit' => true])->assertStatus(422);
        $this->assertSame(0, (int) $this->enBase($reference)->accept);

        $this->postJson("/api/certifications/{$reference}/valider", ['gratuit' => true, 'motif_gratuit' => 'Test phpunit'])->assertOk();

        $certificat = $this->enBase($reference);
        $this->assertSame(1, (int) $certificat->accept);
        $this->assertEqualsWithDelta(0, (float) $certificat->prix, 0.001);
        $this->assertNull($certificat->id_transaction);
        $this->assertSame('Test phpunit', $certificat->motif_gratuit);
        $this->assertSame($transactions, DB::table('transaction')->count());
        $this->assertEqualsWithDelta($avant, $this->solde(), 0.001);

        // Gratuit et validé : il ne redevient pas « au prix standard ».
        $this->prixStandard(self::NOUVEAU);
        $this->assertEqualsWithDelta(0, (float) $this->ligne($reference)['prix'], 0.001);
    }

    public function test_la_gratuite_et_la_double_validation_sont_refusees(): void
    {
        // Gratuité : réservée aux certificats manuels.
        $normal = $this->normal();
        $this->postJson("/api/certifications/{$normal}/valider", ['gratuit' => true, 'motif_gratuit' => 'Test phpunit'])->assertStatus(422);
        $this->assertSame(0, (int) $this->enBase($normal)->accept);

        // Un certificat ne s'encaisse qu'une fois.
        $manuel = $this->manuel()['reference'];
        $this->postJson("/api/certifications/{$manuel}/valider", ['id_compte' => $this->compte])->assertOk();
        $solde = $this->solde();
        $this->postJson("/api/certifications/{$manuel}/valider", ['id_compte' => $this->compte])->assertStatus(422);
        $this->assertEqualsWithDelta($solde, $this->solde(), 0.001);
    }

    public function test_sans_prix_standard_ni_prix_saisi_la_validation_est_refusee(): void
    {
        $reference = $this->normal();
        DB::table('prix_certificat')->delete();

        $this->postJson("/api/certifications/{$reference}/valider", ['id_compte' => $this->compte])->assertStatus(422);
        $this->assertSame(0, (int) $this->enBase($reference)->accept);
    }
}
