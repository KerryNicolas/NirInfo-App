<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\TresorerieService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Tests\TestCase;

// Non-régression des opérations manuelles de l'onglet Gestion (GererController) :
// dépôts et retraits, avec leur effet sur le solde et sur le journal.
class GestionNonRegressionTest extends TestCase
{
    private int $compte;
    private int $dernierIdJournal;

    protected function setUp(): void
    {
        parent::setUp();

        $this->compte = DB::table('compte')->insertGetId(['account_number' => 'TEST-G', 'libelle' => 'TEST GESTION', 'montant' => 10000], 'id_compte');
        $this->actingAs(User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail());
        $this->dernierIdJournal = (int) DB::table('transaction')->max('id_transaction');
    }

    private function solde(): float
    {
        return (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant');
    }

    private function operation(string $type, int $montant, string $raison = 'TEST opération manuelle'): int
    {
        $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => $type, 'montant' => $montant, 'raison' => $raison])->assertStatus(201);

        return (int) DB::table('transaction')->max('id_transaction');
    }

    private function ecritures(): array
    {
        return DB::table('transaction')->where('id_transaction', '>', $this->dernierIdJournal)->orderBy('id_transaction')->get()
            ->map(fn ($t) => [$t->transaction_type, (int) $t->amount, (int) $t->account, $t->reson])->all();
    }

    public function test_un_depot_credite_le_compte(): void
    {
        $this->operation('E', 2500);

        $this->assertSame(12500.0, $this->solde());
        $this->assertSame([['E', 2500, $this->compte, 'TEST opération manuelle']], $this->ecritures());
    }

    public function test_un_retrait_debite_le_compte(): void
    {
        $this->operation('S', 4000);

        $this->assertSame(6000.0, $this->solde());
        $this->assertSame([['S', 4000, $this->compte, 'TEST opération manuelle']], $this->ecritures());
    }

    public function test_un_retrait_superieur_au_solde_est_refuse(): void
    {
        $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => 'S', 'montant' => 10001, 'raison' => 'TEST'])->assertStatus(422);

        $this->assertSame(10000.0, $this->solde());
        $this->assertSame([], $this->ecritures());
    }

    public function test_la_modification_d_une_operation_recalcule_le_solde(): void
    {
        $id = $this->operation('E', 2500);

        $this->putJson("/api/gerer/{$id}", ['compte' => $this->compte, 'type' => 'S', 'montant' => 1000, 'raison' => 'TEST modifiée'])->assertStatus(200);

        $this->assertSame(9000.0, $this->solde());
        $this->assertSame([['S', 1000, $this->compte, 'TEST modifiée']], $this->ecritures());
    }

    public function test_les_motifs_reserves_sont_refuses(): void
    {
        // Motifs que l'application génère elle-même, et que la liste de la
        // Gestion masque : saisis à la main, ils rendraient l'opération invisible.
        $reserves = [
            'achat', 'charge', 'inscription', 'recouvrement', 'prestation', 'recouvrement_prestation', 'certificat',
            'ACHAT', ' Achat ', 'Charge', "inscription\t",              // casse et espaces autour
            'Certification CERT-2026-0001', 'certification', 'correction inscription #12',
            'Correction Recouvrement #7', 'suppression inscription #6644', 'suppression recouvrement #1',
        ];

        foreach ($reserves as $motif) {
            foreach (['E', 'S'] as $type) {
                $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => $type, 'montant' => 100, 'raison' => $motif])
                    ->assertStatus(422, "« {$motif} » ({$type}) aurait dû être refusé.");
            }
        }

        $this->assertSame(10000.0, $this->solde());
        $this->assertSame([], $this->ecritures());
    }

    public function test_les_motifs_libres_restent_acceptes(): void
    {
        // Y compris ceux qui CONTIENNENT un mot réservé : seule la correspondance exacte est refusée.
        $libres = ['Achat de balais et de rasta', 'Achat farilac (2 pcs)', 'Paiement salaire', 'frais Mr Edmond',
                   "Frais d'inscription au salon", 'charges diverses', 'achats', 'Dépot admin'];

        foreach ($libres as $motif) {
            $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => 'E', 'montant' => 100, 'raison' => $motif])
                ->assertStatus(201, "« {$motif} » aurait dû être accepté.");
        }

        $this->assertSame(10000.0 + 100 * count($libres), $this->solde());
        $this->assertSame($libres, array_column($this->ecritures(), 3));
    }

    public function test_une_operation_ne_peut_pas_prendre_un_motif_reserve_a_la_modification(): void
    {
        $id = $this->operation('E', 2500);

        $this->putJson("/api/gerer/{$id}", ['compte' => $this->compte, 'type' => 'E', 'montant' => 2500, 'raison' => 'achat'])->assertStatus(422);
        $this->putJson("/api/gerer/{$id}", ['compte' => $this->compte, 'type' => 'E', 'montant' => 2500, 'raison' => ' Inscription '])->assertStatus(422);

        $this->assertSame([['E', 2500, $this->compte, 'TEST opération manuelle']], $this->ecritures(), "L'opération ne doit pas avoir changé.");
        $this->assertSame(12500.0, $this->solde());
    }

    public function test_un_compte_portant_une_operation_ne_se_supprime_pas(): void
    {
        $id = $this->operation('E', 2500);

        $this->deleteJson("/api/comptes-budget/{$this->compte}")
            ->assertStatus(422)->assertJsonPath('message', 'Ce compte est utilisé par des opérations financières : il ne peut pas être supprimé.');
        $this->assertSame(1, DB::table('compte')->where('id_compte', $this->compte)->count());

        // Une fois l'opération supprimée, le compte n'a plus d'écriture : il redevient supprimable.
        $this->deleteJson("/api/gerer/{$id}")->assertStatus(200);
        $this->deleteJson("/api/comptes-budget/{$this->compte}")->assertStatus(200);
        $this->assertSame(0, DB::table('compte')->where('id_compte', $this->compte)->count());
    }

    /* ── Contrôles sous verrou : aucun compte ne devient négatif par la Gestion ── */

    public function test_supprimer_un_depot_dont_l_argent_a_ete_depense_est_refuse(): void
    {
        $depot = $this->operation('E', 5000);     // solde 15 000
        $this->operation('S', 14000);             // solde 1 000 : l'argent du dépôt a été dépensé

        $this->deleteJson("/api/gerer/{$depot}")
            ->assertStatus(422)->assertJsonPath('message', 'Solde insuffisant : supprimer cette opération rendrait le compte négatif.');

        $this->assertSame(1000.0, $this->solde());
        $this->assertSame(1, DB::table('transaction')->where('id_transaction', $depot)->count(), "Le dépôt doit rester au journal.");
    }

    public function test_une_modification_qui_rendrait_le_compte_negatif_est_refusee(): void
    {
        $depot = $this->operation('E', 5000);     // solde 15 000
        $this->operation('S', 14000);             // solde 1 000

        // Ramener le dépôt de 5 000 à 3 000 retirerait 2 000 d'un compte qui n'en a que 1 000.
        $this->putJson("/api/gerer/{$depot}", ['compte' => $this->compte, 'type' => 'E', 'montant' => 3000, 'raison' => 'TEST'])
            ->assertStatus(422)->assertJsonPath('message', 'Solde insuffisant pour cette modification');
        $this->assertSame(1000.0, $this->solde());
        $this->assertSame(5000, (int) DB::table('transaction')->where('id_transaction', $depot)->value('amount'));

        // L'augmenter, en revanche, est accepté.
        $this->putJson("/api/gerer/{$depot}", ['compte' => $this->compte, 'type' => 'E', 'montant' => 6000, 'raison' => 'TEST'])->assertStatus(200);
        $this->assertSame(2000.0, $this->solde());
    }

    public function test_deplacer_une_operation_vers_un_autre_compte_controle_les_deux_soldes(): void
    {
        $autre = DB::table('compte')->insertGetId(['account_number' => 'TEST-G2', 'libelle' => 'TEST GESTION 2', 'montant' => 300], 'id_compte');
        $retrait = $this->operation('S', 4000);   // solde 6 000

        // Déplacer ce retrait de 4 000 vers un compte qui n'a que 300 : refusé.
        $this->putJson("/api/gerer/{$retrait}", ['compte' => $autre, 'type' => 'S', 'montant' => 4000, 'raison' => 'TEST'])->assertStatus(422);
        $this->assertSame([6000.0, 300.0], [$this->solde(), (float) DB::table('compte')->where('id_compte', $autre)->value('montant')]);

        // Vers ce même compte pour 200 : accepté, et le premier compte récupère ses 4 000.
        $this->putJson("/api/gerer/{$retrait}", ['compte' => $autre, 'type' => 'S', 'montant' => 200, 'raison' => 'TEST'])->assertStatus(200);
        $this->assertSame([10000.0, 100.0], [$this->solde(), (float) DB::table('compte')->where('id_compte', $autre)->value('montant')]);
    }

    public function test_le_motif_virement_est_reserve_mais_pas_les_libelles_proches(): void
    {
        foreach (['virement', 'VIREMENT', ' Virement '] as $motif) {
            $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => 'E', 'montant' => 100, 'raison' => $motif])->assertStatus(422);
        }
        foreach (['Transfert Mr', 'Virement bancaire reçu', 'frais de virement'] as $motif) {
            $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => 'E', 'montant' => 100, 'raison' => $motif])->assertStatus(201);
        }

        $this->assertSame(10300.0, $this->solde());
    }

    public function test_une_operation_qui_ameliore_un_solde_deja_negatif_est_acceptee(): void
    {
        $retrait = $this->operation('S', 4000);   // solde 6 000
        // Solde négatif hérité : rien ne garantit que les soldes réels soient tous positifs.
        DB::table('compte')->where('id_compte', $this->compte)->update(['montant' => -5000]);

        // L'aggraver reste refusé…
        $this->postJson('/api/gerer', ['compte' => $this->compte, 'type' => 'S', 'montant' => 1, 'raison' => 'TEST'])
            ->assertStatus(422)->assertJsonPath('message', 'Solde insuffisant pour ce retrait');
        $this->assertSame(-5000.0, $this->solde());

        // …mais un dépôt l'améliore sans le rendre positif : accepté.
        $this->operation('E', 2000);
        $this->assertSame(-3000.0, $this->solde());

        // Réduire le retrait de 4 000 à 3 500 rend 500 au compte, encore négatif : accepté.
        $this->putJson("/api/gerer/{$retrait}", ['compte' => $this->compte, 'type' => 'S', 'montant' => 3500, 'raison' => 'TEST'])->assertStatus(200);
        $this->assertSame(-2500.0, $this->solde());

        // Supprimer le retrait rend 3 500 au compte : accepté.
        $this->deleteJson("/api/gerer/{$retrait}")->assertStatus(200);
        $this->assertSame(1000.0, $this->solde());
    }

    /* ── Erreur inattendue : message en français, aucun détail technique au navigateur ── */

    public function test_une_erreur_inattendue_donne_un_message_francais_sans_detail_technique(): void
    {
        $id = $this->operation('E', 2500);          // solde 12 500
        $journal = DB::table('transaction')->count();

        // Même en mode débogage, rien de technique ne doit sortir.
        config(['app.debug' => true]);
        Log::spy();
        $this->app->bind(TresorerieService::class, fn () => new class extends TresorerieService {
            public function verrouillerComptes(array $ids): array
            {
                throw new RuntimeException('SQLSTATE[HY000] détail interne confidentiel');
            }
        });

        $corps = ['compte' => $this->compte, 'type' => 'E', 'montant' => 100, 'raison' => 'TEST panne'];
        $appels = [
            "Erreur lors de l'enregistrement" => fn () => $this->postJson('/api/gerer', $corps),
            'Erreur lors de la mise à jour'   => fn () => $this->putJson("/api/gerer/{$id}", $corps),
            'Erreur lors de la suppression'   => fn () => $this->deleteJson("/api/gerer/{$id}"),
        ];

        foreach ($appels as $message => $appel) {
            $reponse = $appel();
            $reponse->assertStatus(500)->assertExactJson(['message' => $message]);
            $this->assertStringNotContainsString('SQLSTATE', $reponse->getContent());
            $this->assertStringNotContainsString('confidentiel', $reponse->getContent());
        }

        // Le détail est dans le journal du serveur, une fois par erreur.
        Log::shouldHaveReceived('error')->times(3)->withArgs(
            fn ($message, $contexte) => ($contexte['exception'] ?? null) instanceof RuntimeException
                && str_contains($contexte['exception']->getMessage(), 'confidentiel')
        );

        // Et rien n'a été écrit.
        $this->assertSame(12500.0, $this->solde());
        $this->assertSame($journal, DB::table('transaction')->count());
        $this->assertSame(2500, (int) DB::table('transaction')->where('id_transaction', $id)->value('amount'));
    }

    public function test_la_suppression_d_une_operation_retablit_le_solde(): void
    {
        $id = $this->operation('S', 4000);

        $this->deleteJson("/api/gerer/{$id}")->assertStatus(200);

        $this->assertSame(10000.0, $this->solde());
        $this->assertSame([], $this->ecritures());
    }
}
