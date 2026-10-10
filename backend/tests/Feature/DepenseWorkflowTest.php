<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\DepenseService;
use App\Services\TresorerieService;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

// Suivi des dépenses : cycle saisie -> validation -> paiement -> annulation,
// écritures de trésorerie, historique, refus, atomicité et verrouillage des
// dépenses de l'ancien système.
class DepenseWorkflowTest extends TestCase
{
    private User $admin;
    private int $compteA;
    private int $compteB;
    private int $dernierIdJournal;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();
        $this->actingAs($this->admin);

        $this->compteA = DB::table('compte')->insertGetId(['account_number' => 'TEST-DA', 'libelle' => 'TEST DEPENSE A', 'montant' => 50000], 'id_compte');
        $this->compteB = DB::table('compte')->insertGetId(['account_number' => 'TEST-DB', 'libelle' => 'TEST DEPENSE B', 'montant' => 50000], 'id_compte');
        $this->dernierIdJournal = (int) DB::table('transaction')->max('id_transaction');
    }

    /* ── outils ── */

    private function creerAchat(float $prix = 1000, int $quantite = 3, array $plus = []): int
    {
        return (int) $this->postJson('/api/achats', array_merge([
            'nom_materiel' => 'TEST-DEPENSE', 'prix_unitaire' => $prix, 'quantite' => $quantite, 'date_achat' => now()->toDateString(),
        ], $plus))->assertStatus(201)->json('id');
    }

    private function creerCharge(float $montant = 2500): int
    {
        return (int) $this->postJson('/api/charges', [
            'designation' => 'TEST-DEPENSE', 'montant' => $montant, 'mois' => 10, 'annee' => 2026, 'date' => now()->toDateString(),
        ])->assertStatus(201)->json('id');
    }

    private function achatValide(float $prix = 1000, int $quantite = 3): int
    {
        $id = $this->creerAchat($prix, $quantite);
        $this->postJson("/api/achats/{$id}/valider")->assertStatus(200);

        return $id;
    }

    private function achatPaye(int $compte = 0): int
    {
        $id = $this->achatValide();
        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $compte ?: $this->compteA])->assertStatus(200);

        return $id;
    }

    private function achat(int $id): ?object
    {
        return DB::table('achat')->where('id_achat', $id)->first();
    }

    private function solde(int $idCompte): float
    {
        return (float) DB::table('compte')->where('id_compte', $idCompte)->value('montant');
    }

    /** Écritures créées depuis le début du test. */
    private function ecritures(): array
    {
        return DB::table('transaction')->where('id_transaction', '>', $this->dernierIdJournal)->orderBy('id_transaction')->get()->all();
    }

    private function actions(string $type, int $id): array
    {
        return DB::table('depense_evenements')->where('type_depense', $type)->where('id_depense', $id)->orderBy('id')->pluck('action')->all();
    }

    /* ── cycle complet ── */

    public function test_cycle_complet_d_un_achat(): void
    {
        // Saisie : enregistrée, aucun mouvement d'argent.
        $id = $this->creerAchat(1000, 3);
        $this->assertSame('enregistree', $this->achat($id)->statut);
        $this->assertSame([], $this->ecritures());

        // Validation : validée, toujours aucun mouvement.
        $this->postJson("/api/achats/{$id}/valider")->assertStatus(200)->assertJsonPath('depense.statut', 'validee');
        $a = $this->achat($id);
        $this->assertSame(['validee', $this->admin->id, 0], [$a->statut, (int) $a->valide_par, (int) $a->id_transaction]);
        $this->assertNotNull($a->date_validation);
        $this->assertSame([], $this->ecritures());
        $this->assertSame(50000.0, $this->solde($this->compteA));

        // Paiement : UNE sortie, le compte est débité.
        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compteA])->assertStatus(200)->assertJsonPath('depense.statut', 'payee');
        $ecritures = $this->ecritures();
        $this->assertCount(1, $ecritures);
        $paiement = $ecritures[0];
        $this->assertSame(
            ['S', 3000, $this->compteA, 'achat', 'achat', 'achat', $id, $this->admin->id, null],
            [$paiement->transaction_type, (int) $paiement->amount, (int) $paiement->account, $paiement->reson,
             $paiement->type_operation, $paiement->origine_table, (int) $paiement->origine_id, (int) $paiement->cree_par, $paiement->transaction_annulee_id]
        );
        $this->assertNotNull($paiement->cree_le);
        $this->assertSame(47000.0, $this->solde($this->compteA));
        $a = $this->achat($id);
        $this->assertSame(['payee', $this->compteA, (int) $paiement->id_transaction, $this->admin->id], [$a->statut, (int) $a->id_compte, (int) $a->id_transaction, (int) $a->paye_par]);
        $this->assertNotNull($a->date_paiement);
        $this->assertSame(1, DB::table('gestion_compte')->where('id_transaction', $paiement->id_transaction)->where('type', 'S')->count());

        // Annulation du paiement : écriture inverse, l'originale est conservée à l'identique.
        $this->postJson("/api/achats/{$id}/annuler-paiement", ['motif' => 'Erreur de compte'])->assertStatus(200)->assertJsonPath('depense.statut', 'validee');
        $ecritures = $this->ecritures();
        $this->assertCount(2, $ecritures);
        $this->assertEquals($paiement, $ecritures[0], "L'écriture de paiement ne doit pas être modifiée par l'annulation.");
        $inverse = $ecritures[1];
        $this->assertSame(
            ['E', 3000, $this->compteA, 'annulation_paiement', 'achat', $id, (int) $paiement->id_transaction],
            [$inverse->transaction_type, (int) $inverse->amount, (int) $inverse->account, $inverse->type_operation,
             $inverse->origine_table, (int) $inverse->origine_id, (int) $inverse->transaction_annulee_id]
        );
        $this->assertSame(50000.0, $this->solde($this->compteA));
        $a = $this->achat($id);
        $this->assertSame(['validee', 0, null, null, null], [$a->statut, (int) $a->id_transaction, $a->id_compte, $a->paye_par, $a->date_paiement]);
        $this->assertSame($this->admin->id, (int) $a->valide_par, 'La validation reste acquise.');

        // Nouveau paiement, sur un autre compte.
        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compteB])->assertStatus(200);
        $ecritures = $this->ecritures();
        $this->assertCount(3, $ecritures);
        $this->assertSame(['S', 3000, $this->compteB], [$ecritures[2]->transaction_type, (int) $ecritures[2]->amount, (int) $ecritures[2]->account]);
        $this->assertSame([50000.0, 47000.0], [$this->solde($this->compteA), $this->solde($this->compteB)]);
        $this->assertSame((int) $ecritures[2]->id_transaction, (int) $this->achat($id)->id_transaction);

        // Historique : toutes les étapes, dans l'ordre.
        $this->assertSame(['saisie', 'validation', 'paiement', 'annulation_paiement', 'paiement'], $this->actions('achat', $id));
        $historique = $this->getJson("/api/achats/{$id}/historique")->assertOk()->json('data');
        $this->assertCount(5, $historique);
        $this->assertSame('Erreur de compte', $historique[3]['motif']);
        $this->assertSame([(int) $paiement->id_transaction, (int) $inverse->id_transaction, (int) $ecritures[2]->id_transaction],
            [(int) $historique[2]['id_transaction'], (int) $historique[3]['id_transaction'], (int) $historique[4]['id_transaction']]);
    }

    public function test_cycle_d_une_charge(): void
    {
        $id = $this->creerCharge(2500);
        $this->assertSame('enregistree', DB::table('charge')->where('id_charge', $id)->value('statut'));

        $this->postJson("/api/charges/{$id}/valider")->assertStatus(200);
        $this->postJson("/api/charges/{$id}/payer", ['id_compte' => $this->compteB])->assertStatus(200);

        $ecritures = $this->ecritures();
        $this->assertCount(1, $ecritures);
        $this->assertSame(['S', 2500, $this->compteB, 'charge', 'charge', 'charge', $id],
            [$ecritures[0]->transaction_type, (int) $ecritures[0]->amount, (int) $ecritures[0]->account, $ecritures[0]->reson,
             $ecritures[0]->type_operation, $ecritures[0]->origine_table, (int) $ecritures[0]->origine_id]);
        $this->assertSame(47500.0, $this->solde($this->compteB));

        $this->postJson("/api/charges/{$id}/annuler-paiement", ['motif' => 'Doublon'])->assertStatus(200);
        $this->assertSame(50000.0, $this->solde($this->compteB));
        $this->assertSame(['saisie', 'validation', 'paiement', 'annulation_paiement'], $this->actions('charge', $id));
    }

    /* ── refus ── */

    public function test_payer_sans_validation_est_refuse(): void
    {
        $id = $this->creerAchat();

        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compteA])
            ->assertStatus(422)->assertJsonPath('message', 'Cette dépense est au statut « enregistrée » : elle ne peut pas être payée.');

        $this->assertSame([], $this->ecritures());
        $this->assertSame(50000.0, $this->solde($this->compteA));
    }

    public function test_payer_deux_fois_ne_cree_qu_une_ecriture(): void
    {
        $id = $this->achatPaye();

        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compteA])->assertStatus(422);
        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compteB])->assertStatus(422);

        $this->assertCount(1, $this->ecritures());
        $this->assertSame([47000.0, 50000.0], [$this->solde($this->compteA), $this->solde($this->compteB)]);
    }

    public function test_solde_insuffisant_refuse_le_paiement(): void
    {
        $id = $this->achatValide(20000, 3); // 60 000 pour 50 000 disponibles

        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compteA])
            ->assertStatus(422)->assertJsonPath('message', 'Solde insuffisant sur TEST DEPENSE A : 50 000 Ar disponibles, 60 000 Ar demandés.');

        $this->assertSame([], $this->ecritures());
        $this->assertSame(50000.0, $this->solde($this->compteA));
        $this->assertSame('validee', $this->achat($id)->statut);
    }

    public function test_compte_inexistant_ou_absent_refuse_le_paiement(): void
    {
        $id = $this->achatValide();

        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => 999999999])->assertStatus(422)->assertJsonPath('message', "Le compte choisi n'existe pas.");
        $this->postJson("/api/achats/{$id}/payer", [])->assertStatus(422)->assertJsonPath('message', 'Choisissez le compte à débiter.');

        $this->assertSame([], $this->ecritures());
    }

    public function test_un_montant_avec_decimales_ne_peut_pas_etre_paye(): void
    {
        $id = $this->achatValide(10.5, 1);

        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compteA])
            ->assertStatus(422)->assertJsonPath('message', "Le montant doit être un nombre entier d'ariary pour être payé.");

        $this->assertSame([], $this->ecritures());
    }

    public function test_annuler_un_paiement_exige_un_motif(): void
    {
        $id = $this->achatPaye();

        $this->postJson("/api/achats/{$id}/annuler-paiement", [])->assertStatus(422)->assertJsonPath('message', 'Le motif est obligatoire.');
        $this->postJson("/api/achats/{$id}/annuler-paiement", ['motif' => '   '])->assertStatus(422);

        $this->assertSame('payee', $this->achat($id)->statut);
        $this->assertCount(1, $this->ecritures());
    }

    public function test_un_paiement_ne_s_annule_qu_une_fois(): void
    {
        $id = $this->achatPaye();

        $this->postJson("/api/achats/{$id}/annuler-paiement", ['motif' => 'Première'])->assertStatus(200);
        $this->postJson("/api/achats/{$id}/annuler-paiement", ['motif' => 'Seconde'])->assertStatus(422);

        $this->assertCount(2, $this->ecritures()); // le paiement et UNE seule écriture inverse
        $this->assertSame(50000.0, $this->solde($this->compteA));
    }

    public function test_une_depense_payee_ne_se_modifie_ni_ne_se_supprime_ni_ne_s_annule(): void
    {
        $id = $this->achatPaye();
        $avant = $this->achat($id);
        $saisie = ['nom_materiel' => 'AUTRE', 'prix_unitaire' => 1, 'quantite' => 1, 'date_achat' => now()->toDateString()];

        $this->putJson("/api/achats/{$id}", $saisie)->assertStatus(422)->assertJsonPath('message', 'Cette dépense est au statut « payée » : elle ne peut pas être modifiée.');
        $this->deleteJson("/api/achats/{$id}")->assertStatus(422);
        $this->postJson("/api/achats/{$id}/annuler", ['motif' => 'test'])->assertStatus(422)->assertJsonPath('message', "Cette dépense est payée : annulez d'abord son paiement.");
        $this->postJson("/api/achats/{$id}/valider")->assertStatus(422);

        $this->assertEquals($avant, $this->achat($id));
    }

    public function test_depense_introuvable(): void
    {
        $this->postJson('/api/achats/999999999/valider')->assertStatus(404)->assertJsonPath('message', 'Dépense introuvable.');
        $this->postJson('/api/charges/999999999/payer', ['id_compte' => $this->compteA])->assertStatus(404);
    }

    /* ── modification, suppression, annulation d'une dépense non payée ── */

    public function test_modifier_une_depense_validee(): void
    {
        $id = $this->achatValide(1000, 3);
        $meme = ['nom_materiel' => 'TEST-DEPENSE renommé', 'prix_unitaire' => 1500, 'quantite' => 2, 'date_achat' => now()->toDateString()];

        // Même montant (1500 x 2 = 3000) : la validation est conservée.
        $this->putJson("/api/achats/{$id}", $meme)->assertStatus(200);
        $this->assertSame('validee', $this->achat($id)->statut);

        // Montant différent : retour à « enregistrée », à valider de nouveau.
        $this->putJson("/api/achats/{$id}", ['prix_unitaire' => 2000] + $meme)->assertStatus(200);
        $a = $this->achat($id);
        $this->assertSame(['enregistree', null, 4000.0], [$a->statut, $a->valide_par, (float) $a->montant]);
        $this->assertSame(['saisie', 'validation', 'retour_enregistree'], $this->actions('achat', $id));
        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compteA])->assertStatus(422);
    }

    public function test_seule_une_depense_enregistree_se_supprime(): void
    {
        $validee = $this->achatValide();
        $this->deleteJson("/api/achats/{$validee}")->assertStatus(422)->assertJsonPath('message', 'Cette dépense est au statut « validée » : elle ne peut pas être supprimée.');
        $this->assertNotNull($this->achat($validee));

        $enregistree = $this->creerAchat();
        $this->deleteJson("/api/achats/{$enregistree}")->assertStatus(200);
        $this->assertNull($this->achat($enregistree));
        $this->assertSame(['saisie', 'suppression'], $this->actions('achat', $enregistree), "La trace de la suppression reste dans l'historique.");
    }

    public function test_annuler_une_depense_non_payee(): void
    {
        $id = $this->achatValide();

        $this->postJson("/api/achats/{$id}/annuler", [])->assertStatus(422)->assertJsonPath('message', 'Le motif est obligatoire.');
        $this->postJson("/api/achats/{$id}/annuler", ['motif' => 'Commande abandonnée'])->assertStatus(200)->assertJsonPath('depense.statut', 'annulee');

        $a = $this->achat($id);
        $this->assertSame(['annulee', $this->admin->id, 'Commande abandonnée'], [$a->statut, (int) $a->annule_par, $a->motif_annulation]);
        $this->assertSame([], $this->ecritures(), 'Annuler une dépense non payée ne crée aucune écriture.');

        // Définitif : plus aucune action possible.
        $this->postJson("/api/achats/{$id}/valider")->assertStatus(422);
        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compteA])->assertStatus(422);
        $this->postJson("/api/achats/{$id}/annuler", ['motif' => 'encore'])->assertStatus(422);
        $this->deleteJson("/api/achats/{$id}")->assertStatus(422);
    }

    /* ── atomicité ── */

    public function test_une_panne_pendant_le_paiement_n_en_laisse_aucune_trace(): void
    {
        $id = $this->achatValide();
        $evenementsAvant = DB::table('depense_evenements')->count();
        $gestionAvant    = DB::table('gestion_compte')->count();

        // Le service échoue à la DERNIÈRE étape (l'événement), après l'écriture
        // au journal, le débit du compte et le changement de statut.
        $this->app->bind(DepenseService::class, fn ($app) => new class($app->make(TresorerieService::class)) extends DepenseService {
            public function evenement(string $type, int $id, string $action, ?string $avant, ?string $apres, ?int $userId, array $plus = []): void
            {
                throw new RuntimeException('panne simulée à la dernière étape');
            }
        });

        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->compteA])->assertStatus(500);

        $a = $this->achat($id);
        $this->assertSame(['validee', 0, null, null], [$a->statut, (int) $a->id_transaction, $a->id_compte, $a->paye_par], 'Le statut ne doit pas avoir changé.');
        $this->assertSame([], $this->ecritures(), 'Aucune écriture ne doit rester au journal.');
        $this->assertSame(50000.0, $this->solde($this->compteA), 'Le compte ne doit pas avoir été débité.');
        $this->assertSame($gestionAvant, DB::table('gestion_compte')->count());
        $this->assertSame($evenementsAvant, DB::table('depense_evenements')->count());
    }

    /* ── protections ── */

    public function test_le_numero_d_ecriture_envoye_par_le_navigateur_est_ignore(): void
    {
        $existante = (int) DB::table('transaction')->where('reson', 'inscription')->max('id_transaction');

        $achat  = $this->creerAchat(1000, 1, ['id_transaction' => $existante]);
        $charge = (int) $this->postJson('/api/charges', [
            'designation' => 'TEST-DEPENSE', 'montant' => 100, 'mois' => 1, 'annee' => 2026, 'date' => now()->toDateString(), 'id_transaction' => $existante,
        ])->assertStatus(201)->json('id');

        $this->assertSame(0, (int) $this->achat($achat)->id_transaction);
        $this->assertSame(0, (int) DB::table('charge')->where('id_charge', $charge)->value('id_transaction'));
    }

    public function test_les_depenses_de_l_ancien_systeme_sont_verrouillees(): void
    {
        foreach (['achat' => ['achats', 'id_achat'], 'charge' => ['charges', 'id_charge']] as $table => [$route, $cle]) {
            $h = DB::table($table)->where('ancien_systeme', 1)->orderBy($cle)->first();
            $this->assertNotNull($h, "Il doit exister une dépense historique dans {$table}.");
            $id = $h->{$cle};
            $ecriture = DB::table('transaction')->where('id_transaction', $h->id_transaction)->first();
            $soldes = DB::table('compte')->orderBy('id_compte')->pluck('montant', 'id_compte')->all();
            $message = "Cette dépense provient de l'ancien système : elle ne peut pas être modifiée.";

            $saisie = $table === 'achat'
                ? ['nom_materiel' => 'X', 'prix_unitaire' => 1, 'quantite' => 1, 'date_achat' => now()->toDateString()]
                : ['designation' => 'X', 'montant' => 1, 'mois' => 1, 'annee' => 2026, 'date' => now()->toDateString()];

            $this->putJson("/api/{$route}/{$id}", $saisie)->assertStatus(422)->assertJsonPath('message', $message);
            $this->deleteJson("/api/{$route}/{$id}")->assertStatus(422)->assertJsonPath('message', $message);
            $this->postJson("/api/{$route}/{$id}/valider")->assertStatus(422);
            $this->postJson("/api/{$route}/{$id}/payer", ['id_compte' => $this->compteA])->assertStatus(422);
            $this->postJson("/api/{$route}/{$id}/annuler-paiement", ['motif' => 'test'])->assertStatus(422)->assertJsonPath('message', $message);
            $this->postJson("/api/{$route}/{$id}/annuler", ['motif' => 'test'])->assertStatus(422);

            $this->assertEquals($h, DB::table($table)->where($cle, $id)->first(), "{$table} n° {$id} ne doit pas avoir changé.");
            $this->assertEquals($ecriture, DB::table('transaction')->where('id_transaction', $h->id_transaction)->first());
            $this->assertSame($soldes, DB::table('compte')->orderBy('id_compte')->pluck('montant', 'id_compte')->all());
        }

        $this->assertSame([], $this->ecritures());
    }

    public function test_les_ecritures_de_depenses_sont_protegees_dans_la_gestion(): void
    {
        $id = $this->achatPaye();
        $paiement = (int) $this->achat($id)->id_transaction;
        $this->postJson("/api/achats/{$id}/annuler-paiement", ['motif' => 'test'])->assertStatus(200);
        $inverse    = (int) DB::table('transaction')->where('transaction_annulee_id', $paiement)->value('id_transaction');
        $historique = (int) DB::table('achat')->where('ancien_systeme', 1)->value('id_transaction');
        $operation  = ['compte' => $this->compteA, 'type' => 'S', 'montant' => 1, 'raison' => 'tentative'];

        foreach ([$paiement, $inverse, $historique] as $idEcriture) {
            $avant = DB::table('transaction')->where('id_transaction', $idEcriture)->first();

            $this->putJson("/api/gerer/{$idEcriture}", $operation)->assertStatus(422);
            $this->deleteJson("/api/gerer/{$idEcriture}")->assertStatus(422);

            $this->assertEquals($avant, DB::table('transaction')->where('id_transaction', $idEcriture)->first(), "L'écriture n° {$idEcriture} ne doit pas avoir changé.");
        }

        $this->assertSame(50000.0, $this->solde($this->compteA));
    }

    public function test_un_compte_utilise_ne_se_supprime_pas(): void
    {
        $this->achatPaye($this->compteA);
        $vierge = DB::table('compte')->insertGetId(['account_number' => 'TEST-DC', 'libelle' => 'TEST DEPENSE VIERGE', 'montant' => 0], 'id_compte');

        $this->deleteJson("/api/comptes-budget/{$this->compteA}")
            ->assertStatus(422)->assertJsonPath('message', 'Ce compte est utilisé par des opérations financières : il ne peut pas être supprimé.');
        $this->assertSame(1, DB::table('compte')->where('id_compte', $this->compteA)->count());

        $this->deleteJson("/api/comptes-budget/{$vierge}")->assertStatus(200);
        $this->assertSame(0, DB::table('compte')->where('id_compte', $vierge)->count());
    }
}
