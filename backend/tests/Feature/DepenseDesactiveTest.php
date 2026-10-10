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

        // Aucune protection particulière dans ce mode : l'écriture se supprime, le compte aussi.
        $this->deleteJson("/api/gerer/{$ecriture}")->assertStatus(200);
        $this->assertSame(0, DB::table('transaction')->where('id_transaction', $ecriture)->count());
        $this->deleteJson("/api/comptes-budget/{$compte}")->assertStatus(200);
        $this->assertSame(0, DB::table('compte')->where('id_compte', $compte)->count());
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
