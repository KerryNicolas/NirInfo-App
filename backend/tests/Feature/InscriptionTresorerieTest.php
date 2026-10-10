<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Non-régression de la logique métier des paiements : chaque opération sur une
// inscription ou un recouvrement doit produire exactement les mêmes soldes et
// les mêmes écritures de journal qu'avant le service de trésorerie.
class InscriptionTresorerieTest extends TestCase
{
    private int $compteA;
    private int $compteB;
    private int $dernierIdJournal;
    private string $matricule;
    private string $session;

    protected function setUp(): void
    {
        parent::setUp();

        // Deux comptes de test (annulés à la fin, comme tout le reste).
        $this->compteA = DB::table('compte')->insertGetId(['account_number' => 'TEST-A', 'libelle' => 'TEST PHPUNIT A', 'montant' => 100000], 'id_compte');
        $this->compteB = DB::table('compte')->insertGetId(['account_number' => 'TEST-B', 'libelle' => 'TEST PHPUNIT B', 'montant' => 100000], 'id_compte');

        $this->matricule = DB::table('etudiant')->orderBy('matricule_etudiant')->value('matricule_etudiant');
        $this->session   = DB::table('session')->orderByDesc('id')->value('code_session');

        $admin = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();
        $this->actingAs($admin);

        $this->dernierIdJournal = (int) DB::table('transaction')->max('id_transaction');
    }

    private function solde(int $idCompte): float
    {
        return (float) DB::table('compte')->where('id_compte', $idCompte)->value('montant');
    }

    /** Écritures créées depuis le début du test : [sens, montant, compte, motif]. */
    private function nouvellesEcritures(): array
    {
        return DB::table('transaction')
            ->where('id_transaction', '>', $this->dernierIdJournal)
            ->orderBy('id_transaction')
            ->get()
            ->map(fn ($t) => [$t->transaction_type, (int) $t->amount, (int) $t->account, $t->reson])
            ->all();
    }

    private function creerInscription(int $montant, int $compte): int
    {
        $reponse = $this->postJson('/api/inscriptions', [
            'matricule'     => $this->matricule,
            'code_session'  => $this->session,
            'montant_paye'  => $montant,
            'id_compte'     => $compte,
            'lieu_paiement' => 'TEST-PHPUNIT',
        ]);
        $reponse->assertStatus(201);

        return (int) DB::table('inscription')->where('ref_facture', $reponse->json('ref_facture'))->value('id_paiement');
    }

    public function test_creation_d_une_inscription(): void
    {
        $id = $this->creerInscription(30000, $this->compteA);

        $this->assertGreaterThan(0, $id);
        $this->assertSame(130000.0, $this->solde($this->compteA));
        $this->assertSame(100000.0, $this->solde($this->compteB));
        $this->assertSame([['E', 30000, $this->compteA, 'inscription']], $this->nouvellesEcritures());

        // Chaque écriture du journal a sa ligne gestion_compte, comme aujourd'hui.
        $idJournal = (int) DB::table('transaction')->max('id_transaction');
        $this->assertSame(1, DB::table('gestion_compte')->where('id_transaction', $idJournal)->where('type', 'E')->where('montant', 30000)->count());

        // La facture automatique est toujours créée.
        $ref = DB::table('inscription')->where('id_paiement', $id)->value('ref_facture');
        $this->assertSame(1, DB::table('facture')->where('ref_facture', $ref)->count());
    }

    public function test_modification_du_montant(): void
    {
        $id = $this->creerInscription(30000, $this->compteA);

        $this->putJson("/api/inscriptions/{$id}", ['montant_paye' => 45000])->assertStatus(200);

        $this->assertSame(145000.0, $this->solde($this->compteA));
        $this->assertSame([
            ['E', 30000, $this->compteA, 'inscription'],
            ['S', 30000, $this->compteA, "correction inscription #{$id}"],
            ['E', 45000, $this->compteA, "correction inscription #{$id}"],
        ], $this->nouvellesEcritures());
    }

    public function test_changement_de_compte(): void
    {
        $id = $this->creerInscription(30000, $this->compteA);

        $this->putJson("/api/inscriptions/{$id}", ['id_compte' => $this->compteB])->assertStatus(200);

        $this->assertSame(100000.0, $this->solde($this->compteA));
        $this->assertSame(130000.0, $this->solde($this->compteB));
        $this->assertSame([
            ['E', 30000, $this->compteA, 'inscription'],
            ['S', 30000, $this->compteA, "correction inscription #{$id}"],
            ['E', 30000, $this->compteB, "correction inscription #{$id}"],
        ], $this->nouvellesEcritures());
    }

    public function test_suppression_d_une_inscription(): void
    {
        $id = $this->creerInscription(30000, $this->compteA);

        $this->deleteJson("/api/inscriptions/{$id}")->assertStatus(200);

        $this->assertSame(100000.0, $this->solde($this->compteA));
        $this->assertSame(0, DB::table('inscription')->where('id_paiement', $id)->count());
        // L'écriture d'origine reste au journal : la suppression ajoute une écriture inverse.
        $this->assertSame([
            ['E', 30000, $this->compteA, 'inscription'],
            ['S', 30000, $this->compteA, "suppression inscription #{$id}"],
        ], $this->nouvellesEcritures());
    }

    public function test_cycle_complet_d_un_recouvrement(): void
    {
        $this->creerInscription(30000, $this->compteA);

        $reponse = $this->postJson('/api/recouvrements', [
            'matricule'    => $this->matricule,
            'code_session' => $this->session,
            'montant_paye' => 10000,
            'id_compte'    => $this->compteB,
        ]);
        $reponse->assertStatus(201);
        $id = (int) DB::table('inscription')->where('ref_facture', $reponse->json('ref_facture'))->value('id_paiement');
        $this->assertSame(110000.0, $this->solde($this->compteB));

        $this->putJson("/api/recouvrements/{$id}", ['montant_paye' => 12000])->assertStatus(200);
        $this->assertSame(112000.0, $this->solde($this->compteB));

        $this->deleteJson("/api/recouvrements/{$id}")->assertStatus(200);
        $this->assertSame(100000.0, $this->solde($this->compteB));
        $this->assertSame(130000.0, $this->solde($this->compteA));

        $this->assertSame([
            ['E', 30000, $this->compteA, 'inscription'],
            ['E', 10000, $this->compteB, 'recouvrement'],
            ['S', 10000, $this->compteB, "correction recouvrement #{$id}"],
            ['E', 12000, $this->compteB, "correction recouvrement #{$id}"],
            ['S', 12000, $this->compteB, "suppression recouvrement #{$id}"],
        ], $this->nouvellesEcritures());
    }

    public function test_les_vrais_comptes_ne_sont_pas_touches(): void
    {
        $avant = DB::table('compte')->whereNotIn('id_compte', [$this->compteA, $this->compteB])->orderBy('id_compte')->pluck('montant', 'id_compte')->all();

        $id = $this->creerInscription(30000, $this->compteA);
        $this->putJson("/api/inscriptions/{$id}", ['montant_paye' => 45000, 'id_compte' => $this->compteB]);
        $this->deleteJson("/api/inscriptions/{$id}");

        $this->assertSame($avant, DB::table('compte')->whereNotIn('id_compte', [$this->compteA, $this->compteB])->orderBy('id_compte')->pluck('montant', 'id_compte')->all());
    }
}
