<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Services\IndicateursTresorerieService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use RuntimeException;
use Tests\TestCase;

// Indicateurs de trésorerie : Trésorerie, À valider, Engagé, Décaissé,
// Disponible réel. La base de test contient déjà de vraies données (soldes,
// 381 dépenses de l'ancien système) : chaque test mesure donc des ÉCARTS par
// rapport à l'état de départ, jamais des valeurs absolues inventées.
class IndicateursTresorerieTest extends TestCase
{
    private const URL = '/api/tresorerie/indicateurs';

    private User $admin;
    private int $a;
    private int $b;
    private array $depart;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();
        $this->actingAs($this->admin);

        $this->a = DB::table('compte')->insertGetId(['account_number' => 'TEST-IA', 'libelle' => 'TEST INDICATEURS A', 'montant' => 50000], 'id_compte');
        $this->b = DB::table('compte')->insertGetId(['account_number' => 'TEST-IB', 'libelle' => 'TEST INDICATEURS B', 'montant' => 10000], 'id_compte');

        $this->depart = $this->lire();
    }

    /* ── outils ── */

    private function lire(array $periode = []): array
    {
        return $this->getJson(self::URL . ($periode ? '?' . http_build_query($periode) : ''))->assertOk()->json();
    }

    /** Les cinq chiffres principaux, en écart par rapport au départ du test. */
    private function ecarts(): array
    {
        $i = $this->lire();

        return [
            'tresorerie' => $i['tresorerie']['total'] - $this->depart['tresorerie']['total'],
            'a_valider'  => $i['a_valider']['total'] - $this->depart['a_valider']['total'],
            'engage'     => $i['engage']['total'] - $this->depart['engage']['total'],
            'decaisse'   => $i['decaisse']['total'] - $this->depart['decaisse']['total'],
            'disponible' => $i['disponible_reel'] - $this->depart['disponible_reel'],
        ];
    }

    private function attendre(array $attendu, string $etape): void
    {
        $this->assertEquals(
            $attendu + ['tresorerie' => 0, 'a_valider' => 0, 'engage' => 0, 'decaisse' => 0, 'disponible' => 0],
            $this->ecarts(),
            $etape
        );
    }

    private function creerAchat(int $prix = 1000, int $quantite = 3): int
    {
        return (int) $this->postJson('/api/achats', [
            'nom_materiel' => 'TEST-INDICATEURS', 'prix_unitaire' => $prix, 'quantite' => $quantite, 'date_achat' => now()->toDateString(),
        ])->assertStatus(201)->json('id');
    }

    private function creerCharge(int $montant = 2500): int
    {
        return (int) $this->postJson('/api/charges', [
            'designation' => 'TEST-INDICATEURS', 'montant' => $montant, 'mois' => 10, 'annee' => 2026, 'date' => now()->toDateString(),
        ])->assertStatus(201)->json('id');
    }

    /** Dépense payée posée directement en base, à une date de paiement choisie. */
    private function achatPayeLe(string $datePaiement, int $montant, int $ancienSysteme = 0): int
    {
        return DB::table('achat')->insertGetId([
            'nom_materiel' => 'TEST-INDICATEURS DATE', 'prix_unitaire' => $montant, 'quantite' => 1, 'montant' => $montant,
            'date_achat' => substr($datePaiement, 0, 10), 'photo_achat' => '', 'id_transaction' => 0, 'matricule_s' => $this->admin->id,
            'statut' => 'payee', 'id_compte' => $this->a, 'date_paiement' => $datePaiement, 'ancien_systeme' => $ancienSysteme,
        ], 'id_achat');
    }

    /* ── structure ── */

    public function test_la_reponse_contient_les_cinq_indicateurs_et_ils_sont_coherents(): void
    {
        $i = $this->depart;

        $this->assertTrue($i['suivi_actif']);
        $this->assertSame(['suivi_actif', 'tresorerie', 'a_valider', 'engage', 'decaisse', 'disponible_reel'], array_keys($i));

        // Trésorerie = somme des soldes de TOUS les comptes, y compris ceux du test.
        $this->assertEquals(round((float) DB::table('compte')->sum(DB::raw('CAST(montant AS DECIMAL(20,2))')), 2), $i['tresorerie']['total']);
        $this->assertEquals($i['tresorerie']['total'], array_sum(array_column($i['tresorerie']['comptes'], 'solde')));
        $this->assertCount(DB::table('compte')->count(), $i['tresorerie']['comptes']);
        $soldes = array_column($i['tresorerie']['comptes'], 'solde', 'id_compte');
        $this->assertEquals([50000, 10000], [$soldes[$this->a], $soldes[$this->b]]);

        // Disponible réel = Trésorerie - Engagé, et rien d'autre.
        $this->assertEquals($i['tresorerie']['total'] - $i['engage']['total'], $i['disponible_reel']);

        // Chaque indicateur de dépenses = achats + charges.
        foreach (['a_valider', 'engage', 'decaisse'] as $cle) {
            $this->assertEquals($i[$cle]['achats']['total'] + $i[$cle]['charges']['total'], $i[$cle]['total'], $cle);
            $this->assertSame($i[$cle]['achats']['nombre'] + $i[$cle]['charges']['nombre'], $i[$cle]['nombre'], $cle);
        }
        // Le décaissé = dépenses du suivi + dépenses de l'ancien système.
        $this->assertEquals($i['decaisse']['suivi']['total'] + $i['decaisse']['ancien_systeme']['total'], $i['decaisse']['total']);

        // Par défaut, la période est le mois en cours.
        $this->assertSame([now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()], [$i['decaisse']['du'], $i['decaisse']['au']]);
    }

    /* ── cycle de vie d'une dépense : jamais comptée deux fois ── */

    public function test_le_cycle_complet_d_un_achat_deplace_les_montants_sans_double_compte(): void
    {
        $id = $this->creerAchat();   // 3 000 Ar
        $this->attendre(['a_valider' => 3000], 'Enregistrée : seulement « à valider », ni engagée ni décaissée.');

        $this->postJson("/api/achats/{$id}/valider")->assertStatus(200);
        $this->attendre(['engage' => 3000, 'disponible' => -3000], 'Validée : engagée, la trésorerie ne bouge pas, le disponible baisse.');

        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->a])->assertStatus(200);
        $this->attendre(['tresorerie' => -3000, 'decaisse' => 3000, 'disponible' => -3000],
            'Payée : sort de l\'engagé, entre dans le décaissé, la trésorerie baisse — le disponible ne bouge PAS.');

        $this->postJson("/api/achats/{$id}/annuler-paiement", ['motif' => 'TEST indicateurs'])->assertStatus(200);
        $this->attendre(['engage' => 3000, 'disponible' => -3000], 'Paiement annulé : de nouveau engagée, la trésorerie est rétablie.');

        $this->postJson("/api/achats/{$id}/annuler", ['motif' => 'TEST indicateurs'])->assertStatus(200);
        $this->attendre([], 'Annulée : plus dans aucun indicateur, tout est revenu au départ.');
    }

    public function test_le_cycle_d_une_charge_alimente_le_detail_des_charges(): void
    {
        $id = $this->creerCharge();   // 2 500 Ar
        $this->postJson("/api/charges/{$id}/valider")->assertStatus(200);

        $i = $this->lire();
        $this->assertEquals(2500, $i['engage']['charges']['total'] - $this->depart['engage']['charges']['total']);
        $this->assertSame(1, $i['engage']['charges']['nombre'] - $this->depart['engage']['charges']['nombre']);
        $this->assertEquals($this->depart['engage']['achats'], $i['engage']['achats'], 'Les achats ne sont pas concernés.');

        $this->postJson("/api/charges/{$id}/payer", ['id_compte' => $this->b])->assertStatus(200);

        $i = $this->lire();
        $this->assertEquals($this->depart['engage']['charges'], $i['engage']['charges']);
        $this->assertEquals(2500, $i['decaisse']['charges']['total'] - $this->depart['decaisse']['charges']['total']);
        $this->assertEquals(2500, $i['decaisse']['suivi']['total'] - $this->depart['decaisse']['suivi']['total']);
        $this->assertEquals($this->depart['decaisse']['ancien_systeme'], $i['decaisse']['ancien_systeme'], 'Une dépense payée par le suivi n\'est pas « ancien système ».');
        $this->attendre(['tresorerie' => -2500, 'decaisse' => 2500, 'disponible' => -2500], 'Charge payée.');

        // Le compte débité est bien celui du paiement.
        $soldes = array_column($i['tresorerie']['comptes'], 'solde', 'id_compte');
        $this->assertEquals([50000, 7500], [$soldes[$this->a], $soldes[$this->b]]);
    }

    public function test_plusieurs_depenses_a_des_statuts_differents_s_additionnent_chacune_une_seule_fois(): void
    {
        $this->creerAchat(1000, 1);                                   // 1 000 enregistré
        $valide = $this->creerAchat(2000, 1);                         // 2 000 validé
        $this->postJson("/api/achats/{$valide}/valider")->assertStatus(200);
        $paye = $this->creerCharge(4000);                             // 4 000 payé
        $this->postJson("/api/charges/{$paye}/valider")->assertStatus(200);
        $this->postJson("/api/charges/{$paye}/payer", ['id_compte' => $this->a])->assertStatus(200);
        $annule = $this->creerAchat(8000, 1);                         // 8 000 annulé
        $this->postJson("/api/achats/{$annule}/annuler", ['motif' => 'TEST indicateurs'])->assertStatus(200);

        $this->attendre(['a_valider' => 1000, 'engage' => 2000, 'decaisse' => 4000, 'tresorerie' => -4000, 'disponible' => -6000],
            'Somme des quatre colonnes de dépenses = 7 000 : les 8 000 annulés ne sont nulle part.');

        $i = $this->lire();
        $this->assertSame([1, 1, 1], [
            $i['a_valider']['nombre'] - $this->depart['a_valider']['nombre'],
            $i['engage']['nombre'] - $this->depart['engage']['nombre'],
            $i['decaisse']['nombre'] - $this->depart['decaisse']['nombre'],
        ]);
    }

    public function test_annuler_une_depense_enregistree_la_retire_de_a_valider(): void
    {
        $id = $this->creerAchat();
        $this->attendre(['a_valider' => 3000], 'Enregistrée.');

        $this->postJson("/api/achats/{$id}/annuler", ['motif' => 'TEST indicateurs'])->assertStatus(200);
        $this->attendre([], 'Annulée avant validation.');
    }

    public function test_modifier_le_montant_d_une_depense_validee_la_renvoie_a_valider(): void
    {
        $id = $this->creerAchat();
        $this->postJson("/api/achats/{$id}/valider")->assertStatus(200);
        $this->attendre(['engage' => 3000, 'disponible' => -3000], 'Validée.');

        // Le montant change : la dépense doit être validée à nouveau, elle n'est plus engagée.
        $this->putJson("/api/achats/{$id}", ['nom_materiel' => 'TEST-INDICATEURS', 'prix_unitaire' => 1000, 'quantite' => 5, 'date_achat' => now()->toDateString()])->assertStatus(200);
        $this->attendre(['a_valider' => 5000], 'Montant modifié : 5 000 à valider, plus rien d\'engagé, le disponible est rétabli.');
    }

    public function test_supprimer_une_depense_enregistree_la_retire_des_indicateurs(): void
    {
        $id = $this->creerCharge();
        $this->attendre(['a_valider' => 2500], 'Enregistrée.');

        $this->deleteJson("/api/charges/{$id}")->assertStatus(200);
        $this->attendre([], 'Supprimée.');
    }

    /* ── ce qui n'est PAS une dépense ── */

    public function test_un_virement_est_neutre_sur_tous_les_indicateurs(): void
    {
        $this->postJson('/api/transferts', ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 20000])->assertStatus(201);

        $this->attendre([], 'Virement : la trésorerie totale, l\'engagé, le décaissé et le disponible ne bougent pas.');
        $soldes = array_column($this->lire()['tresorerie']['comptes'], 'solde', 'id_compte');
        $this->assertEquals([30000, 30000], [$soldes[$this->a], $soldes[$this->b]], 'Seule la répartition entre les deux comptes change.');

        $id = (int) DB::table('transfer')->max('id_transfer');
        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 5000])->assertStatus(200);
        $this->attendre([], 'Virement modifié : toujours neutre.');
        $this->deleteJson("/api/transferts/{$id}")->assertStatus(200);
        $this->attendre([], 'Virement supprimé : toujours neutre.');
    }

    public function test_les_operations_de_gestion_changent_la_tresorerie_mais_ni_l_engage_ni_le_decaisse(): void
    {
        $this->postJson('/api/gerer', ['compte' => $this->a, 'type' => 'E', 'montant' => 7000, 'raison' => 'TEST dépôt indicateurs'])->assertStatus(201);
        $this->attendre(['tresorerie' => 7000, 'disponible' => 7000], 'Dépôt manuel.');

        $this->postJson('/api/gerer', ['compte' => $this->a, 'type' => 'S', 'montant' => 2000, 'raison' => 'TEST retrait indicateurs'])->assertStatus(201);
        $this->attendre(['tresorerie' => 5000, 'disponible' => 5000], 'Retrait manuel : ce n\'est pas une dépense suivie, il n\'entre pas dans le décaissé.');
    }

    /* ── période du décaissé ── */

    public function test_la_periode_inclut_ses_deux_jours_limites_en_entier(): void
    {
        // Une période sans aucune vraie donnée : l'an 2031.
        $periode = ['du' => '2031-03-10', 'au' => '2031-03-20'];
        $this->assertSame(0, $this->lire($periode)['decaisse']['nombre']);

        $this->achatPayeLe('2031-03-09 23:59:59', 1);      // la veille : exclu
        $this->achatPayeLe('2031-03-10 00:00:00', 10);     // premier instant : inclus
        $this->achatPayeLe('2031-03-15 12:00:00', 100);    // au milieu : inclus
        $this->achatPayeLe('2031-03-20 23:59:59', 1000);   // dernier instant : inclus
        $this->achatPayeLe('2031-03-21 00:00:00', 10000);  // le lendemain : exclu

        $d = $this->lire($periode)['decaisse'];
        $this->assertEquals([1110, 3, '2031-03-10', '2031-03-20'], [$d['total'], $d['nombre'], $d['du'], $d['au']]);

        // Un seul jour.
        $d = $this->lire(['du' => '2031-03-21', 'au' => '2031-03-21'])['decaisse'];
        $this->assertEquals([10000, 1], [$d['total'], $d['nombre']]);

        // La période ne touche QUE le décaissé.
        $i = $this->lire($periode);
        $this->assertEquals(
            [$this->depart['tresorerie'], $this->depart['a_valider'], $this->depart['engage'], $this->depart['disponible_reel']],
            [$i['tresorerie'], $i['a_valider'], $i['engage'], $i['disponible_reel']]
        );
    }

    public function test_seules_les_depenses_payees_sont_decaissees_meme_si_une_autre_porte_une_date_de_paiement(): void
    {
        // Situation anormale posée à la main : une dépense non payée qui aurait
        // gardé une date de paiement. C'est le STATUT qui décide, pas la date.
        foreach (['enregistree', 'validee', 'annulee'] as $statut) {
            $id = $this->achatPayeLe('2031-09-15 10:00:00', 500);
            DB::table('achat')->where('id_achat', $id)->update(['statut' => $statut]);
        }
        $this->achatPayeLe('2031-09-15 10:00:00', 40);   // la seule réellement payée

        $d = $this->lire(['du' => '2031-09-01', 'au' => '2031-09-30'])['decaisse'];
        $this->assertEquals([40, 1], [$d['total'], $d['nombre']]);
    }

    public function test_une_seule_borne_fournie_garde_l_autre_au_mois_en_cours(): void
    {
        $debutMois = now()->startOfMonth()->toDateString();
        $finMois   = now()->endOfMonth()->toDateString();

        $d = $this->lire(['du' => '2021-01-01'])['decaisse'];
        $this->assertSame(['2021-01-01', $finMois], [$d['du'], $d['au']]);

        $d = $this->lire(['au' => $finMois])['decaisse'];
        $this->assertSame([$debutMois, $finMois], [$d['du'], $d['au']]);
    }

    public function test_une_depense_payee_puis_au_paiement_annule_sort_du_decaisse_de_sa_periode(): void
    {
        $id = $this->creerAchat();
        $this->postJson("/api/achats/{$id}/valider")->assertStatus(200);
        $this->postJson("/api/achats/{$id}/payer", ['id_compte' => $this->a])->assertStatus(200);

        $aujourdhui = ['du' => now()->toDateString(), 'au' => now()->toDateString()];
        $avant = $this->lire($aujourdhui)['decaisse'];
        $this->assertGreaterThanOrEqual(3000, $avant['total']);

        $this->postJson("/api/achats/{$id}/annuler-paiement", ['motif' => 'TEST indicateurs'])->assertStatus(200);
        $apres = $this->lire($aujourdhui)['decaisse'];
        $this->assertEquals([-3000, -1], [$apres['total'] - $avant['total'], $apres['nombre'] - $avant['nombre']]);
    }

    /* ── dépenses de l'ancien système ── */

    public function test_les_depenses_de_l_ancien_systeme_sont_decaissees_a_leur_date_avec_un_sous_total(): void
    {
        // Toute la période de l'ancien système (2021 à 2024).
        $d = $this->lire(['du' => '2021-01-01', 'au' => '2024-12-31'])['decaisse'];

        $attendu = fn (string $table) => DB::table($table)->where('ancien_systeme', 1)->where('statut', 'payee')
            ->whereBetween('date_paiement', ['2021-01-01 00:00:00', '2024-12-31 23:59:59'])
            ->selectRaw('COUNT(*) AS nombre, COALESCE(SUM(montant), 0) AS total')->first();
        $achats  = $attendu('achat');
        $charges = $attendu('charge');

        $this->assertSame(381, (int) $achats->nombre + (int) $charges->nombre, 'Les 381 dépenses historiques ont toutes une date de paiement.');
        $this->assertEquals([(float) $achats->total + (float) $charges->total, 381], [$d['ancien_systeme']['total'], $d['ancien_systeme']['nombre']]);
        $this->assertEquals([(float) $achats->total, (int) $achats->nombre], [$d['achats']['total'], $d['achats']['nombre']]);
        $this->assertEquals([(float) $charges->total, (int) $charges->nombre], [$d['charges']['total'], $d['charges']['nombre']]);
        $this->assertEquals(['total' => 0, 'nombre' => 0], $d['suivi'], 'Aucune dépense du suivi sur cette période.');
        $this->assertEquals($d['ancien_systeme']['total'], $d['total']);

        // Un seul mois de l'ancien système, comparé à un calcul direct.
        $fevrier = $this->lire(['du' => '2024-02-01', 'au' => '2024-02-29'])['decaisse'];
        $direct = 0.0;
        foreach (['achat', 'charge'] as $table) {
            $direct += (float) DB::table($table)->where('statut', 'payee')
                ->where('date_paiement', '>=', '2024-02-01')->where('date_paiement', '<', '2024-03-01')->sum('montant');
        }
        $this->assertEquals($direct, $fevrier['total']);
        $this->assertEquals($fevrier['total'], $fevrier['ancien_systeme']['total']);
    }

    public function test_les_depenses_de_l_ancien_systeme_ne_sont_ni_a_valider_ni_engagees(): void
    {
        // Elles sont toutes « payée » : elles n'entrent que dans le décaissé de leur époque.
        $this->assertSame(0, DB::table('achat')->where('ancien_systeme', 1)->where('statut', '<>', 'payee')->count());
        $this->assertSame(0, DB::table('charge')->where('ancien_systeme', 1)->where('statut', '<>', 'payee')->count());

        // Une dépense de l'ancien système et une du suivi, le même jour, sont séparées dans le sous-total.
        $this->achatPayeLe('2031-06-15 10:00:00', 700, 1);
        $this->achatPayeLe('2031-06-15 11:00:00', 300, 0);
        $d = $this->lire(['du' => '2031-06-15', 'au' => '2031-06-15'])['decaisse'];
        $this->assertEquals([1000, 700, 300], [$d['total'], $d['ancien_systeme']['total'], $d['suivi']['total']]);
        $this->attendre([], 'Posées hors du mois en cours et déjà payées : aucun effet sur les indicateurs courants.');
    }

    /* ── cas limites ── */

    public function test_un_compte_negatif_est_compte_tel_quel_et_signale(): void
    {
        $negatifs = $this->depart['tresorerie']['comptes_negatifs'];
        DB::table('compte')->where('id_compte', $this->b)->update(['montant' => -4000]);   // était 10 000

        $i = $this->lire();
        $this->assertSame($negatifs + 1, $i['tresorerie']['comptes_negatifs']);
        $this->attendre(['tresorerie' => -14000, 'disponible' => -14000], 'Un solde négatif diminue la trésorerie : il n\'est ni ignoré ni ramené à 0.');
    }

    public function test_le_disponible_reel_peut_devenir_negatif_si_l_engage_depasse_la_tresorerie(): void
    {
        // Rien n'empêche de VALIDER plus que la trésorerie : c'est le paiement qui est refusé.
        $montant = (int) $this->depart['tresorerie']['total'] + 1000;
        $id = $this->creerAchat($montant, 1);
        $this->postJson("/api/achats/{$id}/valider")->assertStatus(200);

        $i = $this->lire();
        $this->assertEquals($this->depart['disponible_reel'] - $montant, $i['disponible_reel']);
        $this->assertLessThan(0, $i['disponible_reel'], 'Le disponible négatif est affiché tel quel : il signale un engagement non couvert.');
    }

    public function test_les_montants_a_decimales_sont_additionnes_sans_erreur_d_arrondi(): void
    {
        foreach ([0.10, 0.20, 0.30] as $montant) {
            DB::table('charge')->insert(['designation' => 'TEST-INDICATEURS DÉCIMALES', 'montant' => $montant, 'mois' => 6, 'annee' => 2031, 'date' => '2031-06-01',
                'photo_charge' => '', 'id_transaction' => 0, 'matricule_s' => $this->admin->id, 'statut' => 'validee']);
        }

        $this->assertSame(0.6, round($this->lire()['engage']['total'] - $this->depart['engage']['total'], 2));
    }

    /* ── validation, droits, erreurs ── */

    public function test_les_dates_invalides_sont_refusees_en_francais(): void
    {
        $this->getJson(self::URL . '?du=10/03/2031')->assertStatus(422)->assertJsonPath('errors.du.0', 'La date de début doit être au format AAAA-MM-JJ.');
        $this->getJson(self::URL . '?au=2031-13-45')->assertStatus(422)->assertJsonPath('errors.au.0', 'La date de fin doit être au format AAAA-MM-JJ.');
        $this->getJson(self::URL . '?du=2031-03-20&au=2031-03-10')->assertStatus(422)->assertJsonPath('message', 'La date de fin ne peut pas précéder la date de début.');
    }

    public function test_la_route_est_reservee_a_la_permission_budgets(): void
    {
        $route = collect(Route::getRoutes())->first(fn ($r) => $r->uri() === 'api/tresorerie/indicateurs');
        $this->assertSame(['GET', 'HEAD'], $route->methods());
        $this->assertContains('permission:budgets.access', $route->gatherMiddleware());

        $simple = $this->admin->replicate();
        $simple->email     = 'phpunit-indicateurs@test.local';
        $simple->matricule = 'TEST-PHPUNIT-IND';
        $simple->role_id   = Role::where('slug', 'user')->firstOrFail()->id;
        $simple->save();
        $simple = $simple->fresh();   // relu en base : la copie gardait en mémoire le rôle de l'administrateur
        $this->assertSame('user', $simple->roleRelation->slug);
        $this->assertFalse($simple->hasPermission('budgets.access'));

        $this->actingAs($simple)->getJson(self::URL)->assertStatus(403);
    }

    public function test_un_visiteur_non_connecte_est_refuse(): void
    {
        $this->app['auth']->forgetGuards();

        $this->getJson(self::URL)->assertStatus(401);
    }

    public function test_la_lecture_n_ecrit_rien_en_base(): void
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->lire();
        $this->lire(['du' => '2021-01-01', 'au' => '2031-12-31']);
        $requetes = array_column(DB::getQueryLog(), 'query');
        DB::disableQueryLog();

        $this->assertNotEmpty($requetes);
        foreach ($requetes as $sql) {
            $this->assertMatchesRegularExpression('/^\s*(select|savepoint|release savepoint)\b/i', $sql, "Requête qui n'est pas une lecture : {$sql}");
        }
    }

    public function test_une_erreur_inattendue_donne_un_message_francais_sans_detail_technique(): void
    {
        Log::spy();
        $this->app->bind(IndicateursTresorerieService::class, fn () => new class extends IndicateursTresorerieService {
            public function tresorerie(): array
            {
                throw new RuntimeException('SQLSTATE[HY000] détail interne confidentiel');
            }
        });

        $reponse = $this->getJson(self::URL);
        $reponse->assertStatus(500)->assertExactJson(['message' => 'Erreur lors du calcul des indicateurs']);
        $this->assertStringNotContainsString('confidentiel', $reponse->getContent());
        Log::shouldHaveReceived('error')->once();
    }

    /* ── suivi désactivé ── */

    public function test_suivi_desactive_seule_la_tresorerie_est_renvoyee_sans_lire_les_colonnes_du_suivi(): void
    {
        config(['depenses.workflow' => false]);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $i = $this->getJson(self::URL . '?du=2021-01-01&au=2024-12-31')->assertOk()->json();
        $requetes = array_column(DB::getQueryLog(), 'query');
        DB::disableQueryLog();

        $this->assertSame(['suivi_actif', 'tresorerie'], array_keys($i), 'Ni engagé, ni décaissé, ni disponible : ils reposent sur le suivi.');
        $this->assertFalse($i['suivi_actif']);
        $this->assertEquals($this->depart['tresorerie'], $i['tresorerie'], 'La trésorerie est la même, suivi activé ou non.');

        // Aucune requête ne touche les tables de dépenses ni une colonne du suivi :
        // la route doit fonctionner sur une base non migrée.
        $sql = implode("\n", $requetes);
        foreach (['`achat`', '`charge`', 'statut', 'ancien_systeme', 'date_paiement', 'depense_evenements', 'type_operation', 'reference_virement'] as $interdit) {
            $this->assertStringNotContainsString($interdit, $sql, "Suivi désactivé : « {$interdit} » ne doit pas être lu.");
        }
    }
}
