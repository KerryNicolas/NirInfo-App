<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Suivi des dépenses DÉSACTIVÉ (réglage par défaut) : l'application doit se
// comporter exactement comme avant et ne lire ni écrire aucune des colonnes
// ajoutées par les migrations 2026_10_11_* et 2026_10_12_* — c'est ce qui lui
// permet de tourner sur une base qui n'a pas encore reçu ces migrations.
class DepenseDesactiveTest extends TestCase
{
    /** Colonnes et table ajoutées pour le suivi des dépenses. */
    private const NOUVEAUTES = '/\b(statut|ancien_systeme|valide_par|date_validation|paye_par|date_paiement|annule_par|date_annulation'
        . '|motif_annulation|id_transaction_unique|depense_evenements|type_operation|origine_table|origine_id'
        . '|transaction_annulee_id|reference_virement|cree_par|cree_le|date_transfer|id_transaction_debit|id_transaction_credit)\b/';

    private const ACHAT  = ['nom_materiel' => 'TEST-DESACTIVE', 'prix_unitaire' => 1000, 'quantite' => 2, 'date_achat' => '2026-10-10'];
    private const CHARGE = ['designation' => 'TEST-DESACTIVE', 'montant' => 700, 'mois' => 10, 'annee' => 2026, 'date' => '2026-10-10'];

    protected function setUp(): void
    {
        parent::setUp();

        config(['depenses.workflow' => false]);
        $this->actingAs(User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail());
    }

    public function test_les_nouvelles_routes_repondent_que_le_suivi_n_est_pas_active(): void
    {
        $message = "Le suivi des dépenses n'est pas activé sur cette installation.";
        $id = (int) DB::table('achat')->max('id_achat');

        foreach (['achats', 'charges'] as $prefixe) {
            $this->postJson("/api/{$prefixe}/{$id}/valider")->assertStatus(409)->assertJsonPath('message', $message);
            $this->postJson("/api/{$prefixe}/{$id}/payer", ['id_compte' => 1])->assertStatus(409);
            $this->postJson("/api/{$prefixe}/{$id}/annuler-paiement", ['motif' => 'x'])->assertStatus(409);
            $this->postJson("/api/{$prefixe}/{$id}/annuler", ['motif' => 'x'])->assertStatus(409);
            $this->getJson("/api/{$prefixe}/{$id}/historique")->assertStatus(409);
        }
    }

    public function test_achats_et_charges_se_comportent_comme_avant(): void
    {
        $evenements = DB::table('depense_evenements')->count();

        // Création, puis modification et suppression SANS contrôle de statut.
        $achat = (int) $this->postJson('/api/achats', self::ACHAT)->assertStatus(201)->json('id');
        DB::table('achat')->where('id_achat', $achat)->update(['statut' => 'payee']); // statut ignoré dans ce mode
        $this->putJson("/api/achats/{$achat}", ['quantite' => 5] + self::ACHAT)->assertStatus(200);
        $this->assertSame(5000.0, (float) DB::table('achat')->where('id_achat', $achat)->value('montant'));
        $this->deleteJson("/api/achats/{$achat}")->assertStatus(200);
        $this->assertSame(0, DB::table('achat')->where('id_achat', $achat)->count());

        $charge = (int) $this->postJson('/api/charges', self::CHARGE)->assertStatus(201)->json('id');
        $this->putJson("/api/charges/{$charge}", ['montant' => 900] + self::CHARGE)->assertStatus(200);
        $this->deleteJson("/api/charges/{$charge}")->assertStatus(200);

        // Une dépense de l'ancien système reste modifiable, comme aujourd'hui.
        $ancien = DB::table('achat')->where('ancien_systeme', 1)->orderBy('id_achat')->first();
        $this->putJson("/api/achats/{$ancien->id_achat}", self::ACHAT)->assertStatus(200);

        // Les listes ne renvoient aucun des nouveaux champs.
        $ligne = $this->getJson('/api/achats')->assertOk()->json('data.0');
        $this->assertSame(['id_achat', 'nom_materiel', 'prix_unitaire', 'quantite', 'montant', 'date_achat', 'photo_achat', 'editeur'], array_keys($ligne));
        $ligne = $this->getJson('/api/charges')->assertOk()->json('data.0');
        $this->assertSame(['id_charge', 'designation', 'montant', 'mois', 'annee', 'date', 'photo_charge', 'editeur'], array_keys($ligne));

        $this->assertSame($evenements, DB::table('depense_evenements')->count(), 'Aucun événement ne doit être écrit quand le suivi est désactivé.');
    }

    public function test_gestion_et_comptes_se_comportent_comme_avant(): void
    {
        $compte = DB::table('compte')->insertGetId(['account_number' => 'TEST-DZ', 'libelle' => 'TEST DESACTIVE', 'montant' => 5000], 'id_compte');
        $ecriture = DB::table('transaction')->insertGetId(['transaction_type' => 'S', 'amount' => 1000, 'reson' => 'achat', 'account' => $compte], 'id_transaction');
        DB::table('achat')->insert(['nom_materiel' => 'TEST-DESACTIVE lié', 'prix_unitaire' => 1000, 'quantite' => 1, 'montant' => 1000, 'date_achat' => '2026-10-10', 'photo_achat' => '', 'id_transaction' => $ecriture]);

        // Dans ce mode, une écriture rattachée à une dépense n'est pas protégée : elle se
        // supprime depuis la Gestion. Le compte, qui n'a alors plus aucune écriture, aussi.
        $this->deleteJson("/api/gerer/{$ecriture}")->assertStatus(200);
        $this->assertSame(0, DB::table('transaction')->where('id_transaction', $ecriture)->count());
        $this->deleteJson("/api/comptes-budget/{$compte}")->assertStatus(200);
        $this->assertSame(0, DB::table('compte')->where('id_compte', $compte)->count());
    }

    /* ── Règles appliquées TOUJOURS, même avec le suivi désactivé ── */

    public function test_la_modification_reste_reservee_a_l_auteur_et_a_l_administrateur(): void
    {
        $admin  = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();
        $roleUser = DB::table('roles')->where('slug', 'user')->value('id');
        $auteur = $admin->replicate(); $auteur->email = 'phpunit-off-a@test.local'; $auteur->matricule = 'TEST-OFF-A'; $auteur->role_id = $roleUser; $auteur->save();
        $tiers  = $admin->replicate(); $tiers->email  = 'phpunit-off-b@test.local'; $tiers->matricule  = 'TEST-OFF-B'; $tiers->role_id  = $roleUser; $tiers->save();

        $achat = (int) $this->actingAs($auteur)->postJson('/api/achats', self::ACHAT)->assertStatus(201)->json('id');

        $this->actingAs($tiers)->putJson("/api/achats/{$achat}", ['quantite' => 9] + self::ACHAT)
            ->assertStatus(403)->assertJsonPath('message', "Seul l'administrateur ou l'auteur de la saisie peut modifier cette dépense.");
        $this->assertSame(2000.0, (float) DB::table('achat')->where('id_achat', $achat)->value('montant'));

        $this->actingAs($auteur)->putJson("/api/achats/{$achat}", ['quantite' => 3] + self::ACHAT)->assertStatus(200);
        $this->actingAs($admin)->putJson("/api/achats/{$achat}", ['quantite' => 4] + self::ACHAT)->assertStatus(200);
        $this->assertSame(4000.0, (float) DB::table('achat')->where('id_achat', $achat)->value('montant'));

        // Une dépense de l'ancien système n'a pas d'auteur exploitable : l'administrateur seulement.
        $ancien = DB::table('charge')->where('ancien_systeme', 1)->orderBy('id_charge')->first();
        $this->actingAs($auteur)->putJson("/api/charges/{$ancien->id_charge}", self::CHARGE)->assertStatus(403);
        $this->assertEquals($ancien, DB::table('charge')->where('id_charge', $ancien->id_charge)->first());
        $this->actingAs($admin)->putJson("/api/charges/{$ancien->id_charge}", self::CHARGE)->assertStatus(200);
    }

    public function test_un_compte_utilise_ne_se_supprime_pas(): void
    {
        $message = 'Ce compte est utilisé par des opérations financières : il ne peut pas être supprimé.';

        // 1. Compte portant une écriture du journal.
        $journal = DB::table('compte')->insertGetId(['account_number' => 'TEST-DJ', 'libelle' => 'TEST DESACTIVE JOURNAL', 'montant' => 500], 'id_compte');
        DB::table('transaction')->insert(['transaction_type' => 'E', 'amount' => 500, 'reson' => 'TEST', 'account' => $journal]);
        $this->deleteJson("/api/comptes-budget/{$journal}")->assertStatus(422)->assertJsonPath('message', $message);

        // 2. Comptes cités seulement par un virement (journal vide).
        $depart  = DB::table('compte')->insertGetId(['account_number' => 'TEST-DV1', 'libelle' => 'TEST DESACTIVE DEPART', 'montant' => 0], 'id_compte');
        $arrivee = DB::table('compte')->insertGetId(['account_number' => 'TEST-DV2', 'libelle' => 'TEST DESACTIVE ARRIVEE', 'montant' => 0], 'id_compte');
        DB::table('transfer')->insert(['starting_account' => $depart, 'destination_account' => $arrivee, 'amount' => 100]);
        $this->deleteJson("/api/comptes-budget/{$depart}")->assertStatus(422);
        $this->deleteJson("/api/comptes-budget/{$arrivee}")->assertStatus(422);

        $this->assertSame(3, DB::table('compte')->whereIn('id_compte', [$journal, $depart, $arrivee])->count());

        // 3. Compte sans écriture ni virement : il se supprime.
        $vierge = DB::table('compte')->insertGetId(['account_number' => 'TEST-DN', 'libelle' => 'TEST DESACTIVE VIERGE', 'montant' => 0], 'id_compte');
        $this->deleteJson("/api/comptes-budget/{$vierge}")->assertStatus(200);
        $this->assertSame(0, DB::table('compte')->where('id_compte', $vierge)->count());
    }

    public function test_les_motifs_reserves_sont_refuses_dans_la_gestion(): void
    {
        $compte = DB::table('compte')->insertGetId(['account_number' => 'TEST-DM', 'libelle' => 'TEST DESACTIVE MOTIF', 'montant' => 5000], 'id_compte');

        foreach (['achat', ' Charge ', 'INSCRIPTION', 'Certification CERT-1', 'suppression inscription #5'] as $motif) {
            $this->postJson('/api/gerer', ['compte' => $compte, 'type' => 'S', 'montant' => 100, 'raison' => $motif])->assertStatus(422);
        }
        $this->postJson('/api/gerer', ['compte' => $compte, 'type' => 'S', 'montant' => 100, 'raison' => 'Achat de balais et de rasta'])->assertStatus(201);
        $this->postJson('/api/gerer', ['compte' => $compte, 'type' => 'S', 'montant' => 100, 'raison' => 'Paiement salaire'])->assertStatus(201);

        $this->assertSame(4800.0, (float) DB::table('compte')->where('id_compte', $compte)->value('montant'));
    }

    public function test_aucune_requete_ne_touche_les_colonnes_du_suivi(): void
    {
        $compte   = DB::table('compte')->insertGetId(['account_number' => 'TEST-DY', 'libelle' => 'TEST DESACTIVE SQL', 'montant' => 5000], 'id_compte');
        $inconnu  = DB::table('compte')->insertGetId(['account_number' => 'TEST-DX', 'libelle' => 'TEST DESACTIVE VIDE', 'montant' => 0], 'id_compte');
        $manuelle = DB::table('transaction')->insertGetId(['transaction_type' => 'E', 'amount' => 500, 'reson' => 'TEST manuelle', 'account' => $compte], 'id_transaction');

        DB::flushQueryLog();
        DB::enableQueryLog();

        // Toutes les routes dont le code a été modifié pour le suivi des dépenses.
        $achat = (int) $this->postJson('/api/achats', self::ACHAT)->assertStatus(201)->json('id');
        $this->getJson('/api/achats')->assertOk();
        $this->putJson("/api/achats/{$achat}", self::ACHAT)->assertStatus(200);
        $this->deleteJson("/api/achats/{$achat}")->assertStatus(200);

        $charge = (int) $this->postJson('/api/charges', self::CHARGE)->assertStatus(201)->json('id');
        $this->getJson('/api/charges')->assertOk();
        $this->putJson("/api/charges/{$charge}", self::CHARGE)->assertStatus(200);
        $this->deleteJson("/api/charges/{$charge}")->assertStatus(200);

        $this->putJson("/api/gerer/{$manuelle}", ['compte' => $compte, 'type' => 'E', 'montant' => 600, 'raison' => 'TEST modifiée'])->assertStatus(200);
        $this->deleteJson("/api/gerer/{$manuelle}")->assertStatus(200);
        $this->postJson('/api/gerer', ['compte' => $compte, 'type' => 'S', 'montant' => 100, 'raison' => 'TEST retrait'])->assertStatus(201);

        // Virements : création, modification, suppression — sans écriture au journal dans ce mode.
        $journal = DB::table('transaction')->count();
        $this->postJson('/api/transferts', ['starting_account' => $compte, 'destination_account' => $inconnu, 'amount' => 300])->assertStatus(201);
        $virement = (int) DB::table('transfer')->max('id_transfer');
        $this->putJson("/api/transferts/{$virement}", ['starting_account' => $compte, 'destination_account' => $inconnu, 'amount' => 200])->assertStatus(200);
        $this->deleteJson("/api/transferts/{$virement}")->assertStatus(200);
        $this->assertSame($journal, DB::table('transaction')->count(), 'Suivi désactivé : un virement ne doit rien écrire au journal.');

        $this->deleteJson("/api/comptes-budget/{$inconnu}")->assertStatus(200);

        $requetes = array_column(DB::getQueryLog(), 'query');
        DB::disableQueryLog();

        $this->assertGreaterThan(20, count($requetes), 'Les requêtes doivent avoir été enregistrées.');

        $fautives = array_values(array_filter($requetes, fn ($sql) => preg_match(self::NOUVEAUTES, $sql) === 1));
        $this->assertSame([], $fautives, "Suivi désactivé : aucune requête ne doit citer une colonne ou une table du suivi des dépenses.");

        // id_compte existe dans la table `compte` : on vérifie seulement qu'il n'est pas lu ou écrit sur achat / charge.
        $surDepenses = array_values(array_filter($requetes, fn ($sql) => preg_match('/`(achat|charge)`/', $sql) === 1 && str_contains($sql, 'id_compte')));
        $this->assertSame([], $surDepenses);
    }
}
