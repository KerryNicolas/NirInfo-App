<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\VerifieIntegriteFinanciere;
use Tests\TestCase;

// Non-régression de bout en bout, par l'API, du cycle d'une dépense — le même
// pour un ACHAT et pour une CHARGE : saisie, validation, paiement, annulation
// du paiement, annulation. À chaque étape sont vérifiés ensemble : le statut,
// le solde du compte, le journal, l'historique, les indicateurs de trésorerie,
// le champ est_auteur, l'intégrité des écritures et les dépenses de l'ancien
// système, qui ne doivent jamais bouger.
class CycleDepenseTest extends TestCase
{
    use VerifieIntegriteFinanciere;

    private User $admin;
    private User $auteur;
    private User $autre;
    private int $compte;
    private array $departIndicateurs;
    private string $departHistorique;
    private int $departJournal;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin  = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();
        $this->auteur = $this->utilisateur('auteur');
        $this->autre  = $this->utilisateur('autre');
        $this->compte = DB::table('compte')->insertGetId(['account_number' => 'TEST-CY', 'libelle' => 'TEST CYCLE', 'montant' => 50000], 'id_compte');

        $this->departIndicateurs = $this->indicateurs();
        $this->departHistorique  = $this->empreinteHistorique();
        $this->departJournal     = (int) DB::table('transaction')->max('id_transaction');
    }

    public static function types(): array
    {
        return [
            'achat'  => ['achats', 'achat', 'id_achat'],
            'charge' => ['charges', 'charge', 'id_charge'],
        ];
    }

    /* ── outils ── */

    private function utilisateur(string $nom): User
    {
        $u = $this->admin->replicate();
        $u->name      = "TEST cycle {$nom}";
        $u->email     = "phpunit-cycle-{$nom}@test.local";
        $u->matricule = 'TEST-PHPUNIT-CY-' . strtoupper($nom);
        $u->role_id   = Role::where('slug', 'user')->firstOrFail()->id;
        $u->save();

        return $u->fresh();
    }

    /** Saisit une dépense de 3 000 Ar. */
    private function saisir(string $route, User $par): int
    {
        $corps = $route === 'achats'
            ? ['nom_materiel' => 'TEST-CYCLE', 'prix_unitaire' => 1000, 'quantite' => 3, 'date_achat' => now()->toDateString()]
            : ['designation' => 'TEST-CYCLE', 'montant' => 3000, 'mois' => 10, 'annee' => 2026, 'date' => now()->toDateString()];

        return (int) $this->actingAs($par)->postJson("/api/{$route}", $corps)->assertStatus(201)->json('id');
    }

    private function indicateurs(): array
    {
        $i = $this->actingAs($this->admin)->getJson('/api/tresorerie/indicateurs')->assertOk()->json();

        return ['tresorerie' => $i['tresorerie']['total'], 'a_valider' => $i['a_valider']['total'], 'engage' => $i['engage']['total'],
                'decaisse' => $i['decaisse']['total'], 'ancien_systeme' => $i['decaisse']['ancien_systeme']['total'], 'disponible' => $i['disponible_reel']];
    }

    /** Vérifie d'un coup tout l'état attendu après une étape. */
    private function etape(string $nom, string $table, string $cle, int $id, string $statut, float $solde, array $journal, array $evenements, array $ecarts): void
    {
        $d = DB::table($table)->where($cle, $id)->first();
        $this->assertSame($statut, $d->statut, "{$nom} : statut");
        $this->assertSame($solde, (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant'), "{$nom} : solde du compte");

        // Journal : les écritures créées depuis le début du test, dans l'ordre.
        $ecritures = DB::table('transaction')->where('id_transaction', '>', $this->departJournal)->orderBy('id_transaction')->get();
        $this->assertSame($journal, $ecritures->map(fn ($t) => $t->transaction_type . ' ' . (int) $t->amount . ' ' . $t->type_operation)->all(), "{$nom} : journal");
        foreach ($ecritures as $t) {
            $this->assertSame([$this->compte, $table, $id], [(int) $t->account, $t->origine_table, (int) $t->origine_id], "{$nom} : chaque écriture est rattachée à CETTE dépense et à CE compte");
        }

        $this->assertSame($evenements, DB::table('depense_evenements')->where('type_depense', $table)->where('id_depense', $id)->orderBy('id')->pluck('action')->all(), "{$nom} : historique");

        $actuels = $this->indicateurs();
        $attendus = $ecarts + ['tresorerie' => 0, 'a_valider' => 0, 'engage' => 0, 'decaisse' => 0, 'ancien_systeme' => 0, 'disponible' => 0];
        foreach ($attendus as $k => $ecart) {
            $this->assertEquals($this->departIndicateurs[$k] + $ecart, $actuels[$k], "{$nom} : indicateur « {$k} »");
        }
        $this->assertEquals($actuels['tresorerie'] - $actuels['engage'], $actuels['disponible'], "{$nom} : disponible réel = trésorerie − engagé");

        $this->assertIntegriteFinanciere("({$nom})");
        $this->assertSame($this->departHistorique, $this->empreinteHistorique(), "{$nom} : les dépenses de l'ancien système ne doivent pas avoir bougé.");
    }

    /* ── le cycle complet ── */

    #[DataProvider('types')]
    public function test_cycle_complet_saisie_validation_paiement_annulations(string $route, string $table, string $cle): void
    {
        $id = $this->saisir($route, $this->auteur);
        $this->etape('saisie', $table, $cle, $id, 'enregistree', 50000.0, [], ['saisie'], ['a_valider' => 3000]);

        $this->actingAs($this->admin)->postJson("/api/{$route}/{$id}/valider")->assertStatus(200)->assertJsonPath('message', 'Dépense validée.');
        $this->etape('validation', $table, $cle, $id, 'validee', 50000.0, [], ['saisie', 'validation'], ['engage' => 3000, 'disponible' => -3000]);

        $this->postJson("/api/{$route}/{$id}/payer", ['id_compte' => $this->compte])->assertStatus(200)->assertJsonPath('message', 'Dépense payée.');
        // Au journal, la sortie d'un paiement porte le type de la dépense (« achat » ou « charge ») ;
        // sa compensation porte « annulation_paiement ».
        $this->etape('paiement', $table, $cle, $id, 'payee', 47000.0, ["S 3000 {$table}"], ['saisie', 'validation', 'paiement'],
            ['tresorerie' => -3000, 'decaisse' => 3000, 'disponible' => -3000]);

        $this->postJson("/api/{$route}/{$id}/annuler-paiement", ['motif' => 'TEST cycle'])->assertStatus(200)->assertJsonPath('message', 'Paiement annulé : le compte a été recrédité.');
        $this->etape('annulation du paiement', $table, $cle, $id, 'validee', 50000.0, ["S 3000 {$table}", 'E 3000 annulation_paiement'],
            ['saisie', 'validation', 'paiement', 'annulation_paiement'], ['engage' => 3000, 'disponible' => -3000]);

        // Second paiement : une NOUVELLE sortie, l'ancienne restant compensée.
        $this->postJson("/api/{$route}/{$id}/payer", ['id_compte' => $this->compte])->assertStatus(200);
        $this->etape('second paiement', $table, $cle, $id, 'payee', 47000.0, ["S 3000 {$table}", 'E 3000 annulation_paiement', "S 3000 {$table}"],
            ['saisie', 'validation', 'paiement', 'annulation_paiement', 'paiement'], ['tresorerie' => -3000, 'decaisse' => 3000, 'disponible' => -3000]);

        $this->postJson("/api/{$route}/{$id}/annuler-paiement", ['motif' => 'TEST cycle'])->assertStatus(200);
        $this->postJson("/api/{$route}/{$id}/annuler", ['motif' => 'TEST fin'])->assertStatus(200)->assertJsonPath('message', 'Dépense annulée.');
        $this->etape('annulation de la dépense', $table, $cle, $id, 'annulee', 50000.0,
            ["S 3000 {$table}", 'E 3000 annulation_paiement', "S 3000 {$table}", 'E 3000 annulation_paiement'],
            ['saisie', 'validation', 'paiement', 'annulation_paiement', 'paiement', 'annulation_paiement', 'annulation'], []);

        // Le journal garde tout : deux sorties, deux compensations, somme nulle.
        $ecritures = DB::table('transaction')->where('id_transaction', '>', $this->departJournal)->get();
        $this->assertSame(0, (int) $ecritures->sum(fn ($t) => $t->transaction_type === 'E' ? $t->amount : -$t->amount));
    }

    #[DataProvider('types')]
    public function test_chaque_action_n_est_possible_qu_une_fois_et_dans_le_bon_ordre(string $route, string $table, string $cle): void
    {
        $id = $this->saisir($route, $this->auteur);
        $this->actingAs($this->admin);
        $refus = fn (string $action, array $corps = []) => $this->postJson("/api/{$route}/{$id}/{$action}", $corps)->assertStatus(422);

        // Enregistrée : ni payer, ni annuler un paiement.
        $refus('payer', ['id_compte' => $this->compte]);
        $refus('annuler-paiement', ['motif' => 'x']);

        $this->postJson("/api/{$route}/{$id}/valider")->assertStatus(200);
        $refus('valider');                                    // pas deux validations
        $refus('annuler-paiement', ['motif' => 'x']);

        $this->postJson("/api/{$route}/{$id}/payer", ['id_compte' => $this->compte])->assertStatus(200);
        $refus('payer', ['id_compte' => $this->compte]);      // pas de double paiement
        $refus('valider');
        $refus('annuler', ['motif' => 'x'])->assertJsonPath('message', "Cette dépense est payée : annulez d'abord son paiement.");
        $this->assertSame(47000.0, (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant'), 'Débité une seule fois.');
        $this->assertSame(1, DB::table('transaction')->where('origine_table', $table)->where('origine_id', $id)->count(), 'Une seule sortie.');

        $this->postJson("/api/{$route}/{$id}/annuler-paiement", ['motif' => 'TEST'])->assertStatus(200);
        $refus('annuler-paiement', ['motif' => 'x']);         // pas de double annulation
        $this->assertSame(50000.0, (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant'), 'Recrédité une seule fois.');
        $this->assertSame(1, DB::table('transaction')->where('origine_table', $table)->where('origine_id', $id)->whereNotNull('transaction_annulee_id')->count(), 'Une seule compensation.');

        $this->postJson("/api/{$route}/{$id}/annuler", ['motif' => 'TEST'])->assertStatus(200);
        foreach ([['valider', []], ['payer', ['id_compte' => $this->compte]], ['annuler', ['motif' => 'x']], ['annuler-paiement', ['motif' => 'x']]] as [$action, $corps]) {
            $refus($action, $corps);                           // annulée : définitif
        }

        $this->assertIntegriteFinanciere();
        $this->assertSame($this->departHistorique, $this->empreinteHistorique());
    }

    #[DataProvider('types')]
    public function test_erreurs_metier_solde_compte_motif_et_montant(string $route, string $table, string $cle): void
    {
        $id = $this->saisir($route, $this->auteur);
        $this->actingAs($this->admin)->postJson("/api/{$route}/{$id}/valider")->assertStatus(200);
        $pauvre = DB::table('compte')->insertGetId(['account_number' => 'TEST-CY2', 'libelle' => 'TEST CYCLE PAUVRE', 'montant' => 2999], 'id_compte');

        // Solde insuffisant à 1 Ar près, compte inexistant, compte absent.
        $r = $this->postJson("/api/{$route}/{$id}/payer", ['id_compte' => $pauvre])->assertStatus(422);
        $this->assertStringStartsWith('Solde insuffisant sur TEST CYCLE PAUVRE', $r->json('message'));
        $this->postJson("/api/{$route}/{$id}/payer", ['id_compte' => 999999999])->assertStatus(422)->assertJsonPath('message', "Le compte choisi n'existe pas.");
        $this->postJson("/api/{$route}/{$id}/payer", [])->assertStatus(422)->assertJsonPath('errors.id_compte.0', 'Choisissez le compte à débiter.');

        // Rien n'a bougé : ni solde, ni statut, ni journal.
        $this->assertSame([2999.0, 50000.0], [(float) DB::table('compte')->where('id_compte', $pauvre)->value('montant'), (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant')]);
        $this->assertSame('validee', DB::table($table)->where($cle, $id)->value('statut'));
        $this->assertSame($this->departJournal, (int) DB::table('transaction')->max('id_transaction'), 'Aucune écriture.');

        // Exactement le solde : accepté, le compte tombe à 0.
        DB::table('compte')->where('id_compte', $pauvre)->update(['montant' => 3000]);
        $this->postJson("/api/{$route}/{$id}/payer", ['id_compte' => $pauvre])->assertStatus(200);
        $this->assertSame(0.0, (float) DB::table('compte')->where('id_compte', $pauvre)->value('montant'));

        // Motif obligatoire pour annuler un paiement.
        $this->postJson("/api/{$route}/{$id}/annuler-paiement", [])->assertStatus(422)->assertJsonPath('errors.motif.0', 'Le motif est obligatoire.');
        $this->postJson("/api/{$route}/{$id}/annuler-paiement", ['motif' => '   '])->assertStatus(422);
        $this->assertSame('payee', DB::table($table)->where($cle, $id)->value('statut'));

        // Dépense inexistante.
        $this->postJson("/api/{$route}/999999999/valider")->assertStatus(404)->assertJsonPath('message', 'Dépense introuvable.');

        $this->assertIntegriteFinanciere();
    }

    #[DataProvider('types')]
    public function test_permissions_et_est_auteur_tout_au_long_du_cycle(string $route, string $table, string $cle): void
    {
        $id = $this->saisir($route, $this->auteur);
        $estAuteur = fn (User $u) => collect($this->actingAs($u)->getJson("/api/{$route}?per_page=200&search=TEST-CYCLE")->assertOk()->json('data'))->firstWhere($cle, $id)['est_auteur'];

        // Ni l'auteur ni un autre utilisateur simple ne valident ou ne paient.
        foreach ([$this->auteur, $this->autre] as $u) {
            $this->actingAs($u)->postJson("/api/{$route}/{$id}/valider")->assertStatus(403)->assertJsonPath('message', 'Accès refusé.');
            $this->actingAs($u)->postJson("/api/{$route}/{$id}/payer", ['id_compte' => $this->compte])->assertStatus(403);
            $this->actingAs($u)->getJson('/api/tresorerie/indicateurs')->assertStatus(403);
        }
        $this->assertSame('enregistree', DB::table($table)->where($cle, $id)->value('statut'));

        // est_auteur reste vrai pour l'auteur et faux pour les autres, quel que soit le statut.
        foreach (['enregistree' => null, 'validee' => 'valider', 'payee' => 'payer'] as $statut => $action) {
            if ($action) {
                $this->actingAs($this->admin)->postJson("/api/{$route}/{$id}/{$action}", ['id_compte' => $this->compte])->assertStatus(200);
            }
            $this->assertSame([true, false, false], [$estAuteur($this->auteur), $estAuteur($this->autre), $estAuteur($this->admin)], "est_auteur au statut {$statut}");
        }

        // Payée : l'auteur ne peut ni annuler le paiement (permission), ni annuler la dépense (statut).
        $this->actingAs($this->auteur)->postJson("/api/{$route}/{$id}/annuler-paiement", ['motif' => 'x'])->assertStatus(403);
        $this->actingAs($this->auteur)->postJson("/api/{$route}/{$id}/annuler", ['motif' => 'x'])->assertStatus(422);
        $this->assertSame('payee', DB::table($table)->where($cle, $id)->value('statut'));

        // Validée de nouveau : un autre utilisateur ne peut pas l'annuler, l'auteur oui.
        $this->actingAs($this->admin)->postJson("/api/{$route}/{$id}/annuler-paiement", ['motif' => 'TEST'])->assertStatus(200);
        $this->actingAs($this->autre)->postJson("/api/{$route}/{$id}/annuler", ['motif' => 'x'])->assertStatus(403);
        $this->actingAs($this->auteur)->postJson("/api/{$route}/{$id}/annuler", ['motif' => 'Saisie en double'])->assertStatus(200);
        $this->assertSame('annulee', DB::table($table)->where($cle, $id)->value('statut'));

        $this->assertIntegriteFinanciere();
        $this->assertSame($this->departHistorique, $this->empreinteHistorique());
    }

    #[DataProvider('types')]
    public function test_suivi_desactive_le_cycle_est_refuse_et_rien_n_est_ecrit(string $route, string $table, string $cle): void
    {
        $id = $this->saisir($route, $this->auteur);
        config(['depenses.workflow' => false]);
        $this->actingAs($this->admin);
        $evenements = DB::table('depense_evenements')->count();

        $this->getJson('/api/depenses/etat')->assertOk()->assertExactJson(['suivi_actif' => false]);
        foreach ([['valider', []], ['payer', ['id_compte' => $this->compte]], ['annuler-paiement', ['motif' => 'x']], ['annuler', ['motif' => 'x']]] as [$action, $corps]) {
            $this->postJson("/api/{$route}/{$id}/{$action}", $corps)->assertStatus(409)->assertJsonPath('message', "Le suivi des dépenses n'est pas activé sur cette installation.");
        }
        $this->getJson("/api/{$route}/{$id}/historique")->assertStatus(409);

        $ligne = collect($this->getJson("/api/{$route}?per_page=200&search=TEST-CYCLE")->assertOk()->json('data'))->firstWhere($cle, $id);
        $this->assertArrayNotHasKey('statut', $ligne);
        $this->assertArrayNotHasKey('est_auteur', $ligne);
        $this->assertSame(['suivi_actif', 'tresorerie'], array_keys($this->getJson('/api/tresorerie/indicateurs')->assertOk()->json()));

        $this->assertSame(50000.0, (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant'));
        $this->assertSame($this->departJournal, (int) DB::table('transaction')->max('id_transaction'), 'Aucune écriture.');
        $this->assertSame($evenements, DB::table('depense_evenements')->count(), 'Aucun événement.');
    }

    /* ── ce qui n'est pas une dépense ── */

    public function test_virements_et_gestion_n_entrent_ni_dans_l_engage_ni_dans_le_decaisse(): void
    {
        $autre = DB::table('compte')->insertGetId(['account_number' => 'TEST-CY3', 'libelle' => 'TEST CYCLE 3', 'montant' => 0], 'id_compte');
        $this->actingAs($this->admin);
        $ecart = fn () => array_map(fn ($k) => $this->indicateurs()[$k] - $this->departIndicateurs[$k], array_combine($c = ['tresorerie', 'a_valider', 'engage', 'decaisse', 'disponible'], $c));

        // Virement créé, modifié, supprimé : le total ne change jamais, seule la répartition.
        $this->postJson('/api/transferts', ['starting_account' => $this->compte, 'destination_account' => $autre, 'amount' => 20000])->assertStatus(201);
        $virement = (int) DB::table('transfer')->max('id_transfer');
        $this->assertSame(['tresorerie' => 0.0, 'a_valider' => 0.0, 'engage' => 0.0, 'decaisse' => 0.0, 'disponible' => 0.0], array_map('floatval', $ecart()));
        $this->assertSame([30000.0, 20000.0], [(float) DB::table('compte')->where('id_compte', $this->compte)->value('montant'), (float) DB::table('compte')->where('id_compte', $autre)->value('montant')]);
        $this->putJson("/api/transferts/{$virement}", ['starting_account' => $this->compte, 'destination_account' => $autre, 'amount' => 5000])->assertStatus(200);
        $this->assertSame(0.0, (float) array_sum(array_map('abs', $ecart())));
        $this->assertIntegriteFinanciere('(virement modifié)');
        $this->deleteJson("/api/transferts/{$virement}")->assertStatus(200);
        $this->assertSame(0.0, (float) array_sum(array_map('abs', $ecart())));

        // Gestion : un dépôt puis un retrait changent la trésorerie et le disponible, rien d'autre.
        $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => 'E', 'montant' => 7000, 'raison' => 'TEST cycle dépôt'])->assertStatus(201);
        $this->assertSame(['tresorerie' => 7000.0, 'a_valider' => 0.0, 'engage' => 0.0, 'decaisse' => 0.0, 'disponible' => 7000.0], array_map('floatval', $ecart()));
        $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => 'S', 'montant' => 2000, 'raison' => 'TEST cycle retrait'])->assertStatus(201);
        $this->assertSame(['tresorerie' => 5000.0, 'a_valider' => 0.0, 'engage' => 0.0, 'decaisse' => 0.0, 'disponible' => 5000.0], array_map('floatval', $ecart()));
        // Un retrait supérieur au solde est refusé et ne change rien.
        $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => 'S', 'montant' => 999999, 'raison' => 'TEST cycle'])->assertStatus(422);
        $this->assertSame(5000.0, (float) $ecart()['tresorerie']);

        $this->assertIntegriteFinanciere();
        $this->assertSame($this->departHistorique, $this->empreinteHistorique());
    }

    /* ── dépenses de l'ancien système ── */

    public function test_les_381_depenses_historiques_sont_intactes_et_verrouillees(): void
    {
        $this->assertSame(381, $this->nombreHistoriques(), 'La base de test porte les 381 dépenses de l\'ancien système.');
        $this->actingAs($this->admin);
        $journal = DB::table('transaction')->count();

        foreach (self::types() as [$route, $table, $cle]) {
            $ancienne = DB::table($table)->where('ancien_systeme', 1)->orderBy($cle)->first();
            $this->assertSame('payee', $ancienne->statut);
            $id = $ancienne->{$cle};

            // Aucune action du suivi n'est acceptée, pas même pour l'administrateur.
            foreach ([['valider', []], ['payer', ['id_compte' => $this->compte]], ['annuler-paiement', ['motif' => 'x']], ['annuler', ['motif' => 'x']]] as [$action, $corps]) {
                $this->postJson("/api/{$route}/{$id}/{$action}", $corps)->assertStatus(422);
            }
            $corps = $route === 'achats'
                ? ['nom_materiel' => 'x', 'prix_unitaire' => 1, 'quantite' => 1, 'date_achat' => '2026-10-01']
                : ['designation' => 'x', 'montant' => 1, 'mois' => 1, 'annee' => 2026, 'date' => '2026-10-01'];
            $this->putJson("/api/{$route}/{$id}", $corps)->assertStatus(422)->assertJsonPath('message', "Cette dépense provient de l'ancien système : elle ne peut pas être modifiée.");
            $this->deleteJson("/api/{$route}/{$id}")->assertStatus(422);
        }

        // Aucune nouvelle écriture, aucune sortie, et les 381 lignes sont exactement celles du départ.
        $this->assertSame($journal, DB::table('transaction')->count(), 'Les tentatives refusées ne créent aucune écriture.');
        $this->assertSame($this->departHistorique, $this->empreinteHistorique());
        $this->assertSame(50000.0, (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant'));
        $this->assertIntegriteFinanciere();
    }
}
