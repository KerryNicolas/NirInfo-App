<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\TresorerieService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

// Non-régression des virements entre comptes (TransferController) : soldes des
// deux comptes après création, modification et suppression.
//
// Ce fichier est la RÉFÉRENCE du comportement d'origine : il tourne avec le
// suivi de trésorerie désactivé (réglage par défaut de l'application), mode
// dans lequel un virement ne laisse aucune écriture au journal. Les virements
// journalisés sont testés dans VirementJournalTest.
class VirementNonRegressionTest extends TestCase
{
    private int $a;
    private int $b;
    private int $c;

    protected function setUp(): void
    {
        parent::setUp();

        config(['depenses.workflow' => false]);

        $this->a = DB::table('compte')->insertGetId(['account_number' => 'TEST-VA', 'libelle' => 'TEST VIREMENT A', 'montant' => 10000], 'id_compte');
        $this->b = DB::table('compte')->insertGetId(['account_number' => 'TEST-VB', 'libelle' => 'TEST VIREMENT B', 'montant' => 2000], 'id_compte');
        $this->c = DB::table('compte')->insertGetId(['account_number' => 'TEST-VC', 'libelle' => 'TEST VIREMENT C', 'montant' => 0], 'id_compte');

        $this->actingAs(User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail());
    }

    private function soldes(): array
    {
        return array_map(
            fn ($id) => (float) DB::table('compte')->where('id_compte', $id)->value('montant'),
            [$this->a, $this->b, $this->c]
        );
    }

    private function virer(int $de, int $vers, int $montant): int
    {
        $this->postJson('/api/transferts', ['starting_account' => $de, 'destination_account' => $vers, 'amount' => $montant])->assertStatus(201);

        return (int) DB::table('transfer')->max('id_transfer');
    }

    public function test_creation_d_un_virement(): void
    {
        $this->virer($this->a, $this->b, 3000);

        $this->assertSame([7000.0, 5000.0, 0.0], $this->soldes());
    }

    public function test_modification_du_montant_et_du_compte_de_destination(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);

        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 4500])->assertStatus(200);
        $this->assertSame([5500.0, 6500.0, 0.0], $this->soldes());

        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->c, 'amount' => 1000])->assertStatus(200);
        $this->assertSame([9000.0, 2000.0, 1000.0], $this->soldes());
    }

    public function test_suppression_d_un_virement(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);

        $this->deleteJson("/api/transferts/{$id}")->assertStatus(200);

        $this->assertSame([10000.0, 2000.0, 0.0], $this->soldes());
        $this->assertSame(0, DB::table('transfer')->where('id_transfer', $id)->count());
    }

    public function test_virement_refuse_si_solde_insuffisant(): void
    {
        $avant = DB::table('transfer')->count();

        $this->postJson('/api/transferts', ['starting_account' => $this->c, 'destination_account' => $this->a, 'amount' => 500])->assertStatus(422);

        $this->assertSame([10000.0, 2000.0, 0.0], $this->soldes());
        $this->assertSame($avant, DB::table('transfer')->count());
    }

    public function test_un_compte_reference_seulement_par_un_virement_ne_se_supprime_pas(): void
    {
        $this->virer($this->a, $this->b, 3000);

        // Les virements ne sont pas écrits au journal : ces deux comptes ont
        // un journal VIDE, et pourtant ils sont utilisés.
        $this->assertSame(0, DB::table('transaction')->whereIn('account', [$this->a, $this->b])->count());

        foreach ([$this->a, $this->b] as $compte) {
            $this->deleteJson("/api/comptes-budget/{$compte}")
                ->assertStatus(422)->assertJsonPath('message', 'Ce compte est utilisé par des opérations financières : il ne peut pas être supprimé.');
            $this->assertSame(1, DB::table('compte')->where('id_compte', $compte)->count());
        }

        // Le troisième compte n'a ni écriture ni virement : il se supprime.
        $this->deleteJson("/api/comptes-budget/{$this->c}")->assertStatus(200);
        $this->assertSame(0, DB::table('compte')->where('id_compte', $this->c)->count());
    }

    /* ── Contrôles sous verrou, actifs même avec le suivi désactivé ── */

    public function test_un_virement_ne_laisse_aucune_ecriture_au_journal_dans_ce_mode(): void
    {
        $journal = DB::table('transaction')->count();
        $gestion = DB::table('gestion_compte')->count();

        $id = $this->virer($this->a, $this->b, 3000);
        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->c, 'amount' => 1000])->assertStatus(200);
        $this->deleteJson("/api/transferts/{$id}")->assertStatus(200);

        $this->assertSame($journal, DB::table('transaction')->count());
        $this->assertSame($gestion, DB::table('gestion_compte')->count());
        $this->assertSame([10000.0, 2000.0, 0.0], $this->soldes());
    }

    public function test_supprimer_un_virement_dont_l_argent_a_ete_depense_est_refuse(): void
    {
        $id = $this->virer($this->a, $this->c, 3000);
        // Le compte d'arrivée a dépensé une partie de l'argent reçu.
        DB::table('compte')->where('id_compte', $this->c)->update(['montant' => 500]);

        $this->deleteJson("/api/transferts/{$id}")->assertStatus(422);

        $this->assertSame([7000.0, 2000.0, 500.0], $this->soldes(), 'Aucun solde ne doit avoir changé.');
        $this->assertSame(1, DB::table('transfer')->where('id_transfer', $id)->count());
    }

    public function test_la_modification_controle_l_effet_net_sur_chaque_compte(): void
    {
        $id = $this->virer($this->a, $this->c, 3000);
        DB::table('compte')->where('id_compte', $this->c)->update(['montant' => 500]); // 2 500 déjà dépensés

        // Porter le virement à 4 000 : le compte d'arrivée GAGNE 1 000, c'est accepté.
        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->c, 'amount' => 4000])->assertStatus(200);
        $this->assertSame([6000.0, 2000.0, 1500.0], $this->soldes());

        // Le ramener à 1 000 : le compte d'arrivée perdrait 3 000 et deviendrait négatif, c'est refusé.
        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->c, 'amount' => 1000])->assertStatus(422);
        $this->assertSame([6000.0, 2000.0, 1500.0], $this->soldes());
        $this->assertSame(4000, (int) DB::table('transfer')->where('id_transfer', $id)->value('amount'));
    }

    public function test_un_montant_a_decimales_est_refuse(): void
    {
        $avant = DB::table('transfer')->count();

        $this->postJson('/api/transferts', ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 100.5])->assertStatus(422);

        $this->assertSame([10000.0, 2000.0, 0.0], $this->soldes());
        $this->assertSame($avant, DB::table('transfer')->count());
    }

    public function test_un_virement_qui_ameliore_un_solde_deja_negatif_est_accepte(): void
    {
        // Solde négatif hérité sur le compte d'arrivée.
        DB::table('compte')->where('id_compte', $this->c)->update(['montant' => -5000]);

        // Il reçoit 3 000 et reste négatif : accepté, son solde s'améliore.
        $id = $this->virer($this->a, $this->c, 3000);
        $this->assertSame([7000.0, 2000.0, -2000.0], $this->soldes());

        // Augmenter le virement l'améliore encore : accepté.
        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->c, 'amount' => 4000])->assertStatus(200);
        $this->assertSame([6000.0, 2000.0, -1000.0], $this->soldes());

        // Le supprimer ou le réduire l'aggraverait : refusé.
        $this->deleteJson("/api/transferts/{$id}")->assertStatus(422);
        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->c, 'amount' => 1000])->assertStatus(422);
        // Et un compte négatif ne peut rien virer.
        $this->postJson('/api/transferts', ['starting_account' => $this->c, 'destination_account' => $this->a, 'amount' => 1])->assertStatus(422);

        $this->assertSame([6000.0, 2000.0, -1000.0], $this->soldes());
        $this->assertSame(4000, (int) DB::table('transfer')->where('id_transfer', $id)->value('amount'));
    }

    public function test_le_service_refuse_lui_meme_un_compte_supprime_ou_identique(): void
    {
        // Le contrôleur valide les comptes AVANT d'appeler le service ; mais un
        // compte peut être supprimé entre cette validation et la prise du
        // verrou. Le service doit donc refuser seul, sans compter sur l'écran.
        $supprime = DB::table('compte')->insertGetId(['account_number' => 'TEST-VX', 'libelle' => 'TEST VIREMENT SUPPRIMÉ', 'montant' => 5000], 'id_compte');
        DB::table('compte')->where('id_compte', $supprime)->delete();

        $id = $this->virer($this->a, $this->b, 3000);
        $service = app(TresorerieService::class);
        $virements = DB::table('transfer')->count();
        $journal = DB::table('transaction')->count();

        $refus = function (callable $operation, string $attendu, string $cas): void {
            try {
                $operation();
                $this->fail("{$cas} : aurait dû être refusé.");
            } catch (HttpException $e) {
                $this->assertSame(422, $e->getStatusCode(), $cas);
                $this->assertStringContainsString($attendu, $e->getMessage(), $cas);
            }
        };

        foreach ([false, true] as $journalise) {
            $mode = $journalise ? 'suivi activé' : 'suivi désactivé';
            $refus(fn () => $service->creerVirement($this->a, $supprime, 100, null, $journalise), "n'existe pas ou vient d'être supprimé", "vers un compte supprimé ({$mode})");
            $refus(fn () => $service->creerVirement($supprime, $this->a, 100, null, $journalise), "n'existe pas ou vient d'être supprimé", "depuis un compte supprimé ({$mode})");
            $refus(fn () => $service->creerVirement($this->a, $this->a, 100, null, $journalise), 'doivent être différents', "même compte ({$mode})");
        }
        $refus(fn () => $service->modifierVirement($id, $this->a, $supprime, 100, null, false), "n'existe pas ou vient d'être supprimé", 'modification vers un compte supprimé');
        $refus(fn () => $service->modifierVirement($id, $this->b, $this->b, 100, null, false), 'doivent être différents', 'modification vers le même compte');

        $this->assertSame([7000.0, 5000.0, 0.0], $this->soldes(), 'Aucun solde ne doit avoir changé.');
        $this->assertSame($virements, DB::table('transfer')->count());
        $this->assertSame($journal, DB::table('transaction')->count());
        $this->assertSame(0, DB::table('transfer')->where('starting_account', $supprime)->orWhere('destination_account', $supprime)->count());
    }

    /* ── Erreur inattendue : message en français, aucun détail technique au navigateur ── */

    public function test_une_erreur_inattendue_donne_un_message_francais_sans_detail_technique(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);

        Log::spy();
        $this->app->bind(TresorerieService::class, fn () => new class extends TresorerieService {
            public function verrouillerComptes(array $ids): array
            {
                throw new RuntimeException('SQLSTATE[HY000] détail interne confidentiel');
            }
        });

        $corps = ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 100];
        $appels = [
            'Erreur lors du virement'        => fn () => $this->postJson('/api/transferts', $corps),
            'Erreur lors de la modification' => fn () => $this->putJson("/api/transferts/{$id}", $corps),
            'Erreur lors de la suppression'  => fn () => $this->deleteJson("/api/transferts/{$id}"),
        ];

        // Même en mode débogage, rien de technique ne doit sortir. Le réglage
        // d'origine est rétabli aussitôt après, quoi qu'il arrive.
        $debogage = config('app.debug');
        config(['app.debug' => true]);
        try {
            foreach ($appels as $message => $appel) {
                $reponse = $appel();
                $reponse->assertStatus(500)->assertExactJson(['message' => $message]);
                $this->assertStringNotContainsString('SQLSTATE', $reponse->getContent());
                $this->assertStringNotContainsString('confidentiel', $reponse->getContent());
            }
        } finally {
            config(['app.debug' => $debogage]);
        }

        // Le détail est dans le journal du serveur, une fois par erreur.
        Log::shouldHaveReceived('error')->times(3)->withArgs(
            fn ($message, $contexte) => ($contexte['exception'] ?? null) instanceof RuntimeException
                && str_contains($contexte['exception']->getMessage(), 'confidentiel')
        );

        // Et rien n'a changé : le virement et les soldes sont intacts.
        $this->assertSame([7000.0, 5000.0, 0.0], $this->soldes());
        $this->assertSame(3000, (int) DB::table('transfer')->where('id_transfer', $id)->value('amount'));

        // Un refus voulu, lui, garde son code et son message. Vérifié hors mode
        // débogage, et sur le code et le message seulement : en débogage,
        // Laravel ajoute ses propres informations au corps de la réponse.
        $this->app->forgetInstance(TresorerieService::class);
        $this->app->bind(TresorerieService::class, fn () => new TresorerieService());
        config(['app.debug' => false]);
        try {
            $this->postJson('/api/transferts', ['starting_account' => $this->c, 'destination_account' => $this->a, 'amount' => 500])
                ->assertStatus(422)->assertJsonPath('message', 'Solde insuffisant sur le compte de départ');
            $this->deleteJson('/api/transferts/999999999')->assertStatus(404);
        } finally {
            config(['app.debug' => $debogage]);
        }
        $this->assertSame($debogage, config('app.debug'), 'Le réglage de débogage doit être rétabli.');
    }

    public function test_un_virement_inexistant(): void
    {
        $this->putJson('/api/transferts/999999999', ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 100])->assertStatus(404);
        $this->deleteJson('/api/transferts/999999999')->assertStatus(404);
    }

    public function test_les_vrais_comptes_ne_sont_pas_touches(): void
    {
        $tests = [$this->a, $this->b, $this->c];
        $avant = DB::table('compte')->whereNotIn('id_compte', $tests)->orderBy('id_compte')->pluck('montant', 'id_compte')->all();

        $id = $this->virer($this->a, $this->b, 3000);
        $this->deleteJson("/api/transferts/{$id}");

        $this->assertSame($avant, DB::table('compte')->whereNotIn('id_compte', $tests)->orderBy('id_compte')->pluck('montant', 'id_compte')->all());
    }
}
