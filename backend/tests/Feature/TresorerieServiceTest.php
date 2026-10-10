<?php

namespace Tests\Feature;

use App\Services\TresorerieService;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

// Le service de trésorerie écrit ensemble le solde, le journal et
// gestion_compte, et renvoie le numéro exact de l'écriture créée.
class TresorerieServiceTest extends TestCase
{
    private TresorerieService $service;
    private int $compte;

    protected function setUp(): void
    {
        parent::setUp();

        $this->service = app(TresorerieService::class);
        $this->compte  = DB::table('compte')->insertGetId(['account_number' => 'TEST-S', 'libelle' => 'TEST PHPUNIT SERVICE', 'montant' => 100000], 'id_compte');
    }

    private function solde(): float
    {
        return (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant');
    }

    public function test_une_entree_credite_le_compte_et_ecrit_le_journal(): void
    {
        $lignesAvant = DB::table('transaction')->count();

        $id = $this->service->mouvement($this->compte, 2500, 'E', 'test entree');

        $this->assertSame(102500.0, $this->solde());
        $this->assertSame($lignesAvant + 1, DB::table('transaction')->count(), 'Une seule écriture doit être créée.');

        $ecriture = DB::table('transaction')->where('id_transaction', $id)->first();
        $this->assertNotNull($ecriture, 'Le numéro renvoyé doit être celui de l\'écriture créée.');
        $this->assertSame('E', $ecriture->transaction_type);
        $this->assertSame(2500, (int) $ecriture->amount);
        $this->assertSame($this->compte, (int) $ecriture->account);
        $this->assertSame('test entree', $ecriture->reson);
        $this->assertSame(now()->toDateString(), (string) $ecriture->date_transaction);

        $gestion = DB::table('gestion_compte')->where('id_transaction', $id)->get();
        $this->assertCount(1, $gestion);
        $this->assertSame(['E', 2500, $this->compte], [$gestion[0]->type, (int) $gestion[0]->montant, (int) $gestion[0]->id_compte]);
    }

    public function test_une_sortie_debite_le_compte(): void
    {
        $id = $this->service->mouvement($this->compte, 40000, 'S', 'test sortie');

        $this->assertSame(60000.0, $this->solde());
        $this->assertSame('S', DB::table('transaction')->where('id_transaction', $id)->value('transaction_type'));
    }

    public function test_plusieurs_mouvements_donnent_des_numeros_distincts_et_le_bon_solde(): void
    {
        $ids = [
            $this->service->mouvement($this->compte, 1000, 'E', 'test a'),
            $this->service->mouvement($this->compte, 300, 'S', 'test b'),
            $this->service->mouvement($this->compte, 50, 'E', 'test c'),
        ];

        $this->assertCount(3, array_unique($ids));
        $this->assertSame(100750.0, $this->solde());
        $this->assertSame(['test a', 'test b', 'test c'], DB::table('transaction')->whereIn('id_transaction', $ids)->orderBy('id_transaction')->pluck('reson')->all());
    }

    public function test_une_erreur_apres_le_mouvement_annule_tout(): void
    {
        $lignesAvant  = DB::table('transaction')->count();
        $gestionAvant = DB::table('gestion_compte')->count();

        try {
            DB::transaction(function () {
                $this->service->mouvement($this->compte, 7000, 'E', 'test annule');
                throw new RuntimeException('panne simulée après le mouvement');
            });
            $this->fail('L\'exception aurait dû remonter.');
        } catch (RuntimeException $e) {
            $this->assertSame('panne simulée après le mouvement', $e->getMessage());
        }

        $this->assertSame(100000.0, $this->solde(), 'Le solde doit être revenu à sa valeur de départ.');
        $this->assertSame($lignesAvant, DB::table('transaction')->count(), 'Aucune écriture ne doit rester au journal.');
        $this->assertSame($gestionAvant, DB::table('gestion_compte')->count());
    }

    public function test_compte_inexistant_comportement_historique_conserve(): void
    {
        // Comportement d'avant la phase 1, volontairement conservé : pas
        // d'erreur, l'écriture est journalisée, aucun solde n'est modifié.
        $soldes = DB::table('compte')->orderBy('id_compte')->pluck('montant', 'id_compte')->all();

        $id = $this->service->mouvement(0, 5000, 'S', 'test compte inexistant');

        $this->assertSame(0, (int) DB::table('transaction')->where('id_transaction', $id)->value('account'));
        $this->assertSame($soldes, DB::table('compte')->orderBy('id_compte')->pluck('montant', 'id_compte')->all());
    }
}
