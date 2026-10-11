<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\TresorerieService;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

// Virements avec le suivi de trésorerie ACTIVÉ : chaque virement écrit deux
// écritures liées au journal ; le modifier ou le supprimer n'efface rien, deux
// écritures inverses compensent les deux d'origine.
class VirementJournalTest extends TestCase
{
    private User $admin;
    private int $a;
    private int $b;
    private int $c;
    private int $dernierIdJournal;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();
        $this->actingAs($this->admin);

        $this->a = DB::table('compte')->insertGetId(['account_number' => 'TEST-JA', 'libelle' => 'TEST JOURNAL A', 'montant' => 10000], 'id_compte');
        $this->b = DB::table('compte')->insertGetId(['account_number' => 'TEST-JB', 'libelle' => 'TEST JOURNAL B', 'montant' => 2000], 'id_compte');
        $this->c = DB::table('compte')->insertGetId(['account_number' => 'TEST-JC', 'libelle' => 'TEST JOURNAL C', 'montant' => 0], 'id_compte');
        $this->dernierIdJournal = (int) DB::table('transaction')->max('id_transaction');
    }

    /* ── outils ── */

    private function soldes(): array
    {
        return array_map(fn ($id) => (float) DB::table('compte')->where('id_compte', $id)->value('montant'), [$this->a, $this->b, $this->c]);
    }

    private function virer(int $de, int $vers, int $montant): int
    {
        $this->postJson('/api/transferts', ['starting_account' => $de, 'destination_account' => $vers, 'amount' => $montant])->assertStatus(201);

        return (int) DB::table('transfer')->max('id_transfer');
    }

    /** Écritures créées depuis le début du test, dans l'ordre. */
    private function ecritures(): array
    {
        return DB::table('transaction')->where('id_transaction', '>', $this->dernierIdJournal)->orderBy('id_transaction')->get()->all();
    }

    private function virement(int $id): ?object
    {
        return DB::table('transfer')->where('id_transfer', $id)->first();
    }

    /** Somme algébrique (entrées - sorties) des écritures de virement créées dans le test. */
    private function sommeDesEcrituresDeVirement(): int
    {
        return array_sum(array_map(fn ($e) => $e->transaction_type === 'E' ? (int) $e->amount : -(int) $e->amount, $this->ecritures()));
    }

    /* ── création ── */

    public function test_un_virement_ecrit_une_sortie_et_une_entree_liees(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);

        $this->assertSame([7000.0, 5000.0, 0.0], $this->soldes());

        $ecritures = $this->ecritures();
        $this->assertCount(2, $ecritures, 'Un virement = exactement deux écritures.');
        [$sortie, $entree] = $ecritures;

        $this->assertSame(['S', 3000, $this->a], [$sortie->transaction_type, (int) $sortie->amount, (int) $sortie->account]);
        $this->assertSame(['E', 3000, $this->b], [$entree->transaction_type, (int) $entree->amount, (int) $entree->account]);

        foreach ($ecritures as $e) {
            $this->assertSame(['virement', 'virement', 'transfer', $id, $this->admin->id, null],
                [$e->reson, $e->type_operation, $e->origine_table, (int) $e->origine_id, (int) $e->cree_par, $e->transaction_annulee_id]);
            $this->assertNotNull($e->cree_le);
        }

        // Même référence sur les deux écritures, au format VIR-…
        $this->assertSame($sortie->reference_virement, $entree->reference_virement);
        $this->assertMatchesRegularExpression('/^VIR-[0-9A-Z]{26}$/', $sortie->reference_virement);

        // La ligne du virement connaît ses deux écritures.
        $v = $this->virement($id);
        $this->assertSame([(int) $sortie->id_transaction, (int) $entree->id_transaction, $this->admin->id],
            [(int) $v->id_transaction_debit, (int) $v->id_transaction_credit, (int) $v->cree_par]);
        $this->assertNotNull($v->date_transfer);

        $this->assertSame(0, $this->sommeDesEcrituresDeVirement(), "Un virement n'est ni une recette ni une dépense.");
    }

    public function test_deux_virements_ont_des_references_differentes(): void
    {
        $this->virer($this->a, $this->b, 1000);
        $this->virer($this->a, $this->c, 1000);

        $references = array_unique(array_map(fn ($e) => $e->reference_virement, $this->ecritures()));
        $this->assertCount(2, $references);
    }

    public function test_solde_insuffisant_rien_n_est_ecrit(): void
    {
        $virements = DB::table('transfer')->count();

        $this->postJson('/api/transferts', ['starting_account' => $this->c, 'destination_account' => $this->a, 'amount' => 500])
            ->assertStatus(422)->assertJsonPath('message', 'Solde insuffisant sur le compte de départ');

        $this->assertSame([], $this->ecritures());
        $this->assertSame([10000.0, 2000.0, 0.0], $this->soldes());
        $this->assertSame($virements, DB::table('transfer')->count());
    }

    public function test_une_panne_entre_les_deux_ecritures_annule_tout(): void
    {
        $virements = DB::table('transfer')->count();
        $gestion   = DB::table('gestion_compte')->count();

        // Le service échoue à la SECONDE écriture (l'entrée), après la sortie.
        $this->app->bind(TresorerieService::class, fn () => new class extends TresorerieService {
            private int $appels = 0;

            public function mouvement(int $idCompte, float $montant, string $sens, string $raison, array $trace = []): int
            {
                if (++$this->appels === 2) {
                    throw new RuntimeException('panne simulée entre la sortie et l\'entrée');
                }

                return parent::mouvement($idCompte, $montant, $sens, $raison, $trace);
            }
        });

        // Message compréhensible, sans le détail technique de la panne.
        $this->postJson('/api/transferts', ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 3000])
            ->assertStatus(500)->assertExactJson(['message' => 'Erreur lors du virement']);

        $this->assertSame([], $this->ecritures(), 'La sortie ne doit pas rester seule au journal.');
        $this->assertSame([10000.0, 2000.0, 0.0], $this->soldes());
        $this->assertSame($virements, DB::table('transfer')->count());
        $this->assertSame($gestion, DB::table('gestion_compte')->count());
    }

    /* ── modification ── */

    public function test_modifier_un_virement_compense_puis_reecrit(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);
        $origine = $this->ecritures();
        $premiereReference = $origine[0]->reference_virement;

        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->c, 'amount' => 1000])->assertStatus(200);

        $this->assertSame([9000.0, 2000.0, 1000.0], $this->soldes());

        $ecritures = $this->ecritures();
        $this->assertCount(6, $ecritures, 'Deux écritures d\'origine, deux compensations, deux nouvelles.');

        // 1. Les deux écritures d'origine sont INTACTES.
        $this->assertEquals($origine[0], $ecritures[0]);
        $this->assertEquals($origine[1], $ecritures[1]);

        // 2. Deux compensations : sens opposé, même compte, même montant, même référence, lien vers l'écriture annulée.
        $this->assertSame(['E', 3000, $this->a, 'annulation_virement', $premiereReference, (int) $origine[0]->id_transaction],
            [$ecritures[2]->transaction_type, (int) $ecritures[2]->amount, (int) $ecritures[2]->account, $ecritures[2]->type_operation, $ecritures[2]->reference_virement, (int) $ecritures[2]->transaction_annulee_id]);
        $this->assertSame(['S', 3000, $this->b, 'annulation_virement', $premiereReference, (int) $origine[1]->id_transaction],
            [$ecritures[3]->transaction_type, (int) $ecritures[3]->amount, (int) $ecritures[3]->account, $ecritures[3]->type_operation, $ecritures[3]->reference_virement, (int) $ecritures[3]->transaction_annulee_id]);

        // 3. Deux nouvelles écritures, avec une NOUVELLE référence.
        $this->assertSame(['S', 1000, $this->a, 'virement'], [$ecritures[4]->transaction_type, (int) $ecritures[4]->amount, (int) $ecritures[4]->account, $ecritures[4]->type_operation]);
        $this->assertSame(['E', 1000, $this->c, 'virement'], [$ecritures[5]->transaction_type, (int) $ecritures[5]->amount, (int) $ecritures[5]->account, $ecritures[5]->type_operation]);
        $this->assertSame($ecritures[4]->reference_virement, $ecritures[5]->reference_virement);
        $this->assertNotSame($premiereReference, $ecritures[4]->reference_virement);

        // Toutes rattachées au même virement, qui pointe maintenant sur les nouvelles.
        foreach ($ecritures as $e) {
            $this->assertSame(['transfer', $id], [$e->origine_table, (int) $e->origine_id]);
        }
        $v = $this->virement($id);
        $this->assertSame([$this->a, $this->c, 1000, (int) $ecritures[4]->id_transaction, (int) $ecritures[5]->id_transaction],
            [(int) $v->starting_account, (int) $v->destination_account, (int) $v->amount, (int) $v->id_transaction_debit, (int) $v->id_transaction_credit]);

        $this->assertSame(0, $this->sommeDesEcrituresDeVirement());
    }

    public function test_une_modification_refusee_ne_laisse_aucune_ecriture(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);
        $avant = $this->ecritures();
        $ligne = $this->virement($id);

        // 20 000 depuis un compte qui, une fois l'ancien virement annulé, n'en a que 10 000.
        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 20000])
            ->assertStatus(422)->assertJsonPath('message', 'Solde insuffisant sur le compte de départ');

        $this->assertEquals($avant, $this->ecritures());
        $this->assertEquals($ligne, $this->virement($id));
        $this->assertSame([7000.0, 5000.0, 0.0], $this->soldes());
    }

    /* ── suppression ── */

    public function test_supprimer_un_virement_garde_les_quatre_ecritures(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);
        $origine = $this->ecritures();
        $reference = $origine[0]->reference_virement;

        $this->deleteJson("/api/transferts/{$id}")->assertStatus(200);

        $this->assertNull($this->virement($id), 'La ligne du virement est supprimée.');
        $this->assertSame([10000.0, 2000.0, 0.0], $this->soldes(), 'Les soldes sont rétablis.');

        $ecritures = $this->ecritures();
        $this->assertCount(4, $ecritures, 'Les deux écritures d\'origine et leurs deux compensations restent au journal.');
        $this->assertEquals($origine[0], $ecritures[0]);
        $this->assertEquals($origine[1], $ecritures[1]);
        $this->assertSame([(int) $origine[0]->id_transaction, (int) $origine[1]->id_transaction],
            [(int) $ecritures[2]->transaction_annulee_id, (int) $ecritures[3]->transaction_annulee_id]);

        // Toujours retrouvables SANS la ligne du virement : par la référence, et par le numéro du virement.
        $this->assertSame(4, DB::table('transaction')->where('reference_virement', $reference)->count());
        $this->assertSame(4, DB::table('transaction')->where('origine_table', 'transfer')->where('origine_id', $id)->count());
        $this->assertSame(0, $this->sommeDesEcrituresDeVirement());
    }

    public function test_supprimer_deux_fois_ne_cree_pas_de_compensation_supplementaire(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);

        $this->deleteJson("/api/transferts/{$id}")->assertStatus(200);
        $this->deleteJson("/api/transferts/{$id}")->assertStatus(404);
        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 100])->assertStatus(404);

        $this->assertCount(4, $this->ecritures());
        $this->assertSame([10000.0, 2000.0, 0.0], $this->soldes());
    }

    public function test_supprimer_un_virement_dont_l_argent_a_ete_depense_est_refuse(): void
    {
        $id = $this->virer($this->a, $this->c, 3000);
        DB::table('compte')->where('id_compte', $this->c)->update(['montant' => 500]);
        $avant = $this->ecritures();

        $this->deleteJson("/api/transferts/{$id}")->assertStatus(422);

        $this->assertEquals($avant, $this->ecritures());
        $this->assertNotNull($this->virement($id));
        $this->assertSame([7000.0, 2000.0, 500.0], $this->soldes());
    }

    /* ── cohérence des écritures ── */

    public function test_des_ecritures_incoherentes_bloquent_la_suppression_et_la_modification(): void
    {
        $falsifications = [
            'montant de la sortie modifié'   => fn ($v) => DB::table('transaction')->where('id_transaction', $v->id_transaction_debit)->update(['amount' => 1]),
            'compte de l\'entrée modifié'    => fn ($v) => DB::table('transaction')->where('id_transaction', $v->id_transaction_credit)->update(['account' => $this->c]),
            'référence de l\'entrée modifiée' => fn ($v) => DB::table('transaction')->where('id_transaction', $v->id_transaction_credit)->update(['reference_virement' => 'VIR-AUTRE']),
            'sens de la sortie inversé'      => fn ($v) => DB::table('transaction')->where('id_transaction', $v->id_transaction_debit)->update(['transaction_type' => 'E']),
            'sortie rattachée à un autre virement' => fn ($v) => DB::table('transaction')->where('id_transaction', $v->id_transaction_debit)->update(['origine_id' => 999999999]),
            'entrée rattachée à un autre virement' => fn ($v) => DB::table('transaction')->where('id_transaction', $v->id_transaction_credit)->update(['origine_id' => 999999999]),
            'sortie rattachée à une autre table'   => fn ($v) => DB::table('transaction')->where('id_transaction', $v->id_transaction_debit)->update(['origine_table' => 'achat']),
            'entrée absente'                 => fn ($v) => DB::table('transfer')->where('id_transfer', $v->id_transfer)->update(['id_transaction_credit' => 999999999]),
            'les deux numéros identiques'    => fn ($v) => DB::table('transfer')->where('id_transfer', $v->id_transfer)->update(['id_transaction_credit' => $v->id_transaction_debit]),
        ];

        foreach ($falsifications as $cas => $falsifier) {
            $id = $this->virer($this->a, $this->b, 100);
            $falsifier($this->virement($id));
            $soldes  = $this->soldes();
            $journal = DB::table('transaction')->count();
            $message = 'Les écritures de ce virement sont introuvables ou incohérentes : opération refusée.';

            $this->deleteJson("/api/transferts/{$id}")->assertStatus(422)->assertJsonPath('message', $message);
            $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 50])->assertStatus(422);

            $this->assertSame($journal, DB::table('transaction')->count(), "{$cas} : aucune écriture ne doit être ajoutée.");
            $this->assertSame($soldes, $this->soldes(), "{$cas} : aucun solde ne doit changer.");
            $this->assertNotNull($this->virement($id), "{$cas} : le virement ne doit pas être supprimé.");
        }
    }

    public function test_des_ecritures_deja_compensees_ne_le_sont_pas_une_seconde_fois(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);
        $v = $this->virement($id);
        // Une compensation existe déjà pour la sortie (situation anormale, créée à la main).
        DB::table('transaction')->insert(['transaction_type' => 'E', 'amount' => 3000, 'reson' => 'virement', 'account' => $this->a, 'transaction_annulee_id' => $v->id_transaction_debit]);
        $journal = DB::table('transaction')->count();

        $this->deleteJson("/api/transferts/{$id}")->assertStatus(422)->assertJsonPath('message', 'Les écritures de ce virement ont déjà été annulées.');

        $this->assertSame($journal, DB::table('transaction')->count());
        $this->assertNotNull($this->virement($id));
    }

    /* ── virement historique et changement de mode ── */

    public function test_le_virement_de_l_ancien_systeme_est_verrouille(): void
    {
        // Virement sans écriture liée, comme celui de 235 583 Ar hérité de l'ancien système.
        $historique = DB::table('transfer')->whereNull('id_transaction_debit')->orderBy('id_transfer')->first();
        $this->assertNotNull($historique, "La base de test doit contenir le virement de l'ancien système.");
        $soldes = DB::table('compte')->orderBy('id_compte')->pluck('montant', 'id_compte')->all();
        $message = "Ce virement provient de l'ancien système : il ne peut être ni modifié ni supprimé.";

        $this->putJson("/api/transferts/{$historique->id_transfer}", ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 100])
            ->assertStatus(422)->assertJsonPath('message', $message);
        $this->deleteJson("/api/transferts/{$historique->id_transfer}")->assertStatus(422)->assertJsonPath('message', $message);

        $this->assertEquals($historique, $this->virement($historique->id_transfer), 'Le virement historique ne doit pas avoir changé.');
        $this->assertSame($soldes, DB::table('compte')->orderBy('id_compte')->pluck('montant', 'id_compte')->all());
        $this->assertSame([], $this->ecritures(), 'Aucune écriture ne doit être inventée pour lui.');
    }

    public function test_un_virement_journalise_est_verrouille_si_le_suivi_est_desactive(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);
        $avant = $this->ecritures();

        config(['depenses.workflow' => false]);

        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 100])->assertStatus(422);
        $this->deleteJson("/api/transferts/{$id}")->assertStatus(422);

        $this->assertEquals($avant, $this->ecritures());
        $this->assertSame([7000.0, 5000.0, 0.0], $this->soldes(), 'Les soldes ne doivent pas changer sans écriture au journal.');
        $this->assertNotNull($this->virement($id));
    }

    /* ── Gestion ── */

    public function test_les_ecritures_de_virement_sont_masquees_et_protegees_dans_la_gestion(): void
    {
        $id = $this->virer($this->a, $this->b, 3000);
        $this->putJson("/api/transferts/{$id}", ['starting_account' => $this->a, 'destination_account' => $this->b, 'amount' => 1000])->assertStatus(200);
        $ecritures = $this->ecritures(); // 2 d'origine, 2 compensations, 2 nouvelles
        $this->assertCount(6, $ecritures);

        // Aucune n'apparaît dans la liste de la Gestion.
        $liste = array_column($this->getJson('/api/gerer?per_page=200')->assertOk()->json('data'), 'id_transaction');
        foreach ($ecritures as $e) {
            $this->assertNotContains((int) $e->id_transaction, $liste);
        }

        // Aucune ne se modifie ni ne se supprime par la Gestion.
        foreach ($ecritures as $e) {
            $this->putJson("/api/gerer/{$e->id_transaction}", ['compte' => $this->a, 'type' => 'S', 'montant' => 1, 'raison' => 'tentative'])->assertStatus(422);
            $this->deleteJson("/api/gerer/{$e->id_transaction}")->assertStatus(422);
        }

        $this->assertEquals($ecritures, $this->ecritures());
        $this->assertSame([9000.0, 3000.0, 0.0], $this->soldes());
    }

    public function test_un_compte_cite_par_un_virement_journalise_ne_se_supprime_pas(): void
    {
        $id = $this->virer($this->a, $this->c, 3000);
        $this->deleteJson("/api/transferts/{$id}")->assertStatus(200);

        // Même après la suppression du virement, ses écritures restent au journal : les comptes restent utilisés.
        $this->deleteJson("/api/comptes-budget/{$this->c}")->assertStatus(422);
        $this->deleteJson("/api/comptes-budget/{$this->b}")->assertStatus(200); // jamais utilisé
    }
}
