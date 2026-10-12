<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

// Champ « est_auteur » des listes d'achats et de charges (suivi activé) :
// l'utilisateur connecté est-il celui qui a saisi la dépense ? Il sert à
// l'écran pour proposer « Annuler » à l'auteur. Il ne donne aucun droit :
// chaque cas vérifie aussi ce que le SERVEUR accepte ou refuse réellement.
class EstAuteurTest extends TestCase
{
    private const CLES_SUIVI_DESACTIVE = [
        'achats'  => ['id_achat', 'nom_materiel', 'prix_unitaire', 'quantite', 'montant', 'date_achat', 'photo_achat', 'editeur'],
        'charges' => ['id_charge', 'designation', 'montant', 'mois', 'annee', 'date', 'photo_charge', 'editeur'],
    ];
    private const CLES_SUIVI = ['statut', 'id_compte', 'compte', 'date_validation', 'date_paiement', 'ancien_systeme', 'est_auteur'];

    private User $admin;
    private User $auteur;
    private User $autre;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin  = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();
        $this->auteur = $this->utilisateur('auteur');
        $this->autre  = $this->utilisateur('autre');
    }

    private function utilisateur(string $nom): User
    {
        $u = $this->admin->replicate();
        $u->name      = "TEST {$nom}";
        $u->email     = "phpunit-est-auteur-{$nom}@test.local";
        $u->matricule = 'TEST-PHPUNIT-EA-' . strtoupper($nom);
        $u->role_id   = Role::where('slug', 'user')->firstOrFail()->id;
        $u->save();

        return $u->fresh();
    }

    private function creer(string $type, User $par): int
    {
        $corps = $type === 'achats'
            ? ['nom_materiel' => 'TEST-EST-AUTEUR', 'prix_unitaire' => 1000, 'quantite' => 2, 'date_achat' => now()->toDateString()]
            : ['designation' => 'TEST-EST-AUTEUR', 'montant' => 2500, 'mois' => 10, 'annee' => 2026, 'date' => now()->toDateString()];

        return (int) $this->actingAs($par)->postJson("/api/{$type}", $corps)->assertStatus(201)->json('id');
    }

    /** Ligne d'une dépense telle que la liste la renvoie à cet utilisateur. */
    private function ligne(string $type, int $id, User $pour): array
    {
        $cle = $type === 'achats' ? 'id_achat' : 'id_charge';
        $lignes = $this->actingAs($pour)->getJson("/api/{$type}?per_page=200&search=TEST-EST-AUTEUR")->assertOk()->json('data');

        return collect($lignes)->firstWhere($cle, $id);
    }

    public function test_est_auteur_est_vrai_pour_l_auteur_et_faux_pour_tous_les_autres(): void
    {
        foreach (['achats', 'charges'] as $type) {
            $id = $this->creer($type, $this->auteur);

            // Booléens stricts : true pour l'auteur, false pour un autre utilisateur comme pour l'administrateur.
            $this->assertTrue($this->ligne($type, $id, $this->auteur)['est_auteur'], "{$type} : auteur");
            $this->assertFalse($this->ligne($type, $id, $this->autre)['est_auteur'], "{$type} : autre utilisateur");
            $this->assertFalse($this->ligne($type, $id, $this->admin)['est_auteur'], "{$type} : administrateur, qui n'a pas saisi");

            // L'administrateur est bien l'auteur de ses propres saisies.
            $sienne = $this->creer($type, $this->admin);
            $this->assertTrue($this->ligne($type, $sienne, $this->admin)['est_auteur'], "{$type} : administrateur auteur");
            $this->assertFalse($this->ligne($type, $sienne, $this->auteur)['est_auteur']);
        }
    }

    public function test_la_reponse_n_expose_que_le_booleen_jamais_l_identifiant_de_l_auteur(): void
    {
        foreach (['achats', 'charges'] as $type) {
            $id = $this->creer($type, $this->auteur);
            $ligne = $this->ligne($type, $id, $this->autre);

            // Exactement les champs d'avant + est_auteur, dans cet ordre.
            $this->assertSame(array_merge(self::CLES_SUIVI_DESACTIVE[$type], self::CLES_SUIVI), array_keys($ligne), $type);

            $brut = $this->actingAs($this->autre)->getJson("/api/{$type}?per_page=200")->assertOk()->getContent();
            $this->assertStringNotContainsString('"_auteur"', $brut, "{$type} : la colonne interne ne doit pas sortir.");
            $this->assertStringContainsString('"est_auteur":false', $brut, $type);
            $this->assertStringNotContainsString('matricule_s', $brut, $type);
        }
    }

    public function test_l_enveloppe_la_recherche_et_le_tri_de_la_liste_sont_inchanges(): void
    {
        $premier = $this->creer('achats', $this->auteur);
        $second  = $this->creer('achats', $this->auteur);

        $r = $this->actingAs($this->auteur)->getJson('/api/achats?per_page=1&search=TEST-EST-AUTEUR&sort=a.id_achat&sort_dir=asc')->assertOk()->json();
        // Les sept champs de la pagination, inchangés et dans le même ordre, suivis des deux totaux de la liste.
        $this->assertSame(['data', 'total', 'per_page', 'current_page', 'last_page', 'from', 'to', 'total_montant', 'total_actif'], array_keys($r));
        $this->assertSame([2, 1, 1, 2, 1, 1], [$r['total'], $r['per_page'], $r['current_page'], $r['last_page'], $r['from'], $r['to']]);
        $this->assertSame($premier, $r['data'][0]['id_achat']);
        $this->assertSame('2000.00', $r['data'][0]['montant'], 'Les montants gardent leur forme (texte à deux décimales).');

        $r = $this->getJson('/api/achats?per_page=1&page=2&search=TEST-EST-AUTEUR&sort=a.id_achat&sort_dir=asc')->assertOk()->json();
        $this->assertSame($second, $r['data'][0]['id_achat']);

        // Liste vide : « data » reste un tableau vide.
        $this->assertSame([], $this->getJson('/api/achats?search=AUCUN-RESULTAT-POSSIBLE-XYZ')->assertOk()->json('data'));
    }

    public function test_une_depense_de_l_ancien_systeme_n_a_jamais_d_auteur(): void
    {
        foreach (['achats', 'charges'] as $type) {
            foreach ([$this->admin, $this->auteur] as $utilisateur) {
                $lignes = collect($this->actingAs($utilisateur)->getJson("/api/{$type}?per_page=200")->assertOk()->json('data'))->where('ancien_systeme', 1);
                $this->assertNotEmpty($lignes, "{$type} : la base de test contient des dépenses de l'ancien système.");
                $this->assertSame([false], $lignes->pluck('est_auteur')->unique()->values()->all(), $type);
            }
        }
    }

    public function test_seul_l_identifiant_exact_compte_pas_une_valeur_qui_lui_ressemble(): void
    {
        $id = $this->creer('achats', $this->auteur);
        $moi = (string) $this->auteur->id;

        // Valeurs proches de l'identifiant, posées à la main : aucune ne fait de lui l'auteur…
        foreach (["0{$moi}", "{$moi}.0", " {$moi}", "{$moi}abc", $this->auteur->name, $this->auteur->matricule, '', null] as $valeur) {
            DB::table('achat')->where('id_achat', $id)->update(['matricule_s' => $valeur]);
            $this->assertFalse($this->ligne('achats', $id, $this->auteur)['est_auteur'], 'matricule_s = ' . var_export($valeur, true));
            // …et le serveur refuse l'annulation dans les mêmes cas : l'écran et le serveur disent la même chose.
            $this->actingAs($this->auteur)->postJson("/api/achats/{$id}/annuler", ['motif' => 'TEST'])->assertStatus(403);
        }

        DB::table('achat')->where('id_achat', $id)->update(['matricule_s' => $moi]);
        $this->assertTrue($this->ligne('achats', $id, $this->auteur)['est_auteur']);
    }

    public function test_est_auteur_ne_donne_aucun_droit_le_serveur_reste_seul_juge(): void
    {
        foreach (['achats', 'charges'] as $type) {
            $table = $type === 'achats' ? 'achat' : 'charge';
            $cle   = $type === 'achats' ? 'id_achat' : 'id_charge';
            $statut = fn (int $id) => DB::table($table)->where($cle, $id)->value('statut');

            // Un autre utilisateur, sans permission : est_auteur faux ET annulation refusée par le serveur.
            $id = $this->creer($type, $this->auteur);
            $this->assertFalse($this->ligne($type, $id, $this->autre)['est_auteur']);
            $this->actingAs($this->autre)->postJson("/api/{$type}/{$id}/annuler", ['motif' => 'tentative'])
                ->assertStatus(403)->assertJsonPath('message', "Seul l'administrateur ou l'auteur de la saisie peut annuler cette dépense.");
            $this->assertSame('enregistree', $statut($id), "{$type} : rien n'a changé.");

            // L'auteur : est_auteur vrai ET annulation acceptée, avec un motif obligatoire.
            $this->assertTrue($this->ligne($type, $id, $this->auteur)['est_auteur']);
            $this->actingAs($this->auteur)->postJson("/api/{$type}/{$id}/annuler", [])->assertStatus(422);
            $this->actingAs($this->auteur)->postJson("/api/{$type}/{$id}/annuler", ['motif' => 'Saisie en double'])->assertStatus(200);
            $this->assertSame('annulee', $statut($id));

            // Titulaire de « depenses.valider » (l'administrateur) : est_auteur faux, mais annulation acceptée par sa permission.
            $id = $this->creer($type, $this->auteur);
            $this->assertTrue($this->admin->hasPermission('depenses.valider'));
            $this->assertFalse($this->ligne($type, $id, $this->admin)['est_auteur']);
            $this->actingAs($this->admin)->postJson("/api/{$type}/{$id}/annuler", ['motif' => 'Décision administrateur'])->assertStatus(200);
            $this->assertSame('annulee', $statut($id));

            // Être l'auteur ne suffit pas quand le STATUT l'interdit : une dépense payée ne s'annule pas.
            $id = $this->creer($type, $this->auteur);
            $compte = DB::table('compte')->insertGetId(['account_number' => 'TEST-EA', 'libelle' => 'TEST EST AUTEUR', 'montant' => 50000], 'id_compte');
            $this->actingAs($this->admin)->postJson("/api/{$type}/{$id}/valider")->assertStatus(200);
            $this->actingAs($this->admin)->postJson("/api/{$type}/{$id}/payer", ['id_compte' => $compte])->assertStatus(200);
            $this->assertTrue($this->ligne($type, $id, $this->auteur)['est_auteur'], 'Toujours l\'auteur…');
            $this->actingAs($this->auteur)->postJson("/api/{$type}/{$id}/annuler", ['motif' => 'TEST'])
                ->assertStatus(422)->assertJsonPath('message', "Cette dépense est payée : annulez d'abord son paiement.");
            $this->assertSame('payee', $statut($id), '…mais le serveur refuse.');
            // Et l'auteur ne peut ni valider ni payer : ces actions exigent leur permission.
            $this->actingAs($this->auteur)->postJson("/api/{$type}/{$id}/annuler-paiement", ['motif' => 'TEST'])->assertStatus(403);
        }
    }

    public function test_suivi_desactive_la_reponse_est_exactement_celle_d_avant(): void
    {
        $achat  = $this->creer('achats', $this->auteur);
        $charge = $this->creer('charges', $this->auteur);
        config(['depenses.workflow' => false]);

        foreach (['achats' => $achat, 'charges' => $charge] as $type => $id) {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $ligne = $this->ligne($type, $id, $this->auteur);
            $sql = implode("\n", array_column(DB::getQueryLog(), 'query'));
            DB::disableQueryLog();

            // Les huit champs d'origine, et eux seuls : ni est_auteur, ni colonne interne.
            $this->assertSame(self::CLES_SUIVI_DESACTIVE[$type], array_keys($ligne), $type);
            foreach (['est_auteur', '_auteur', 'statut', 'ancien_systeme', 'date_paiement'] as $interdit) {
                $this->assertStringNotContainsString($interdit, $sql, "{$type}, suivi désactivé : « {$interdit} » ne doit pas être lu.");
            }
        }
    }
}
