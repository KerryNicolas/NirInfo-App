<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

// Phase 6, étape 2 :
//  - GET /api/depenses/etat : un booléen qui dit aux écrans si le suivi des
//    dépenses est activé ;
//  - messages FRANÇAIS des validations des achats, des charges, des opérations
//    de Gestion et des virements. Les règles, les codes HTTP, les noms de
//    champs et la structure des réponses ne changent pas.
class EtatSuiviEtValidationsTest extends TestCase
{
    private User $admin;
    private int $compte;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();
        $this->actingAs($this->admin);
        $this->compte = DB::table('compte')->insertGetId(['account_number' => 'TEST-EV', 'libelle' => 'TEST ETAT VALIDATIONS', 'montant' => 50000], 'id_compte');
    }

    private function utilisateur(string $role): User
    {
        $u = $this->admin->replicate();
        $u->email     = "phpunit-etat-{$role}@test.local";
        $u->matricule = 'TEST-PHPUNIT-' . strtoupper(substr($role, 0, 8));
        $u->role_id   = Role::where('slug', $role)->firstOrFail()->id;
        $u->save();

        return $u->fresh();
    }

    /* ── route d'état ── */

    public function test_la_route_d_etat_renvoie_uniquement_un_booleen(): void
    {
        $this->getJson('/api/depenses/etat')->assertOk()->assertExactJson(['suivi_actif' => true]);

        config(['depenses.workflow' => false]);
        $this->getJson('/api/depenses/etat')->assertOk()->assertExactJson(['suivi_actif' => false]);
    }

    public function test_la_route_d_etat_ne_lit_aucune_donnee_metier(): void
    {
        foreach ([true, false] as $actif) {
            config(['depenses.workflow' => $actif]);
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->getJson('/api/depenses/etat')->assertOk();
            $requetes = array_column(DB::getQueryLog(), 'query');
            DB::disableQueryLog();

            // Seul le contrôle des droits interroge la base (rôle et permissions).
            foreach ($requetes as $sql) {
                $this->assertMatchesRegularExpression('/^select .* from `(roles|permissions|role_permissions|users)`/i', $sql, "Requête inattendue : {$sql}");
            }
            $tout = implode("\n", $requetes);
            foreach (['`achat`', '`charge`', '`compte`', '`transaction`', 'statut', 'ancien_systeme', 'depense_evenements'] as $interdit) {
                $this->assertStringNotContainsString($interdit, $tout, "La route d'état ne doit pas lire « {$interdit} ».");
            }
        }
    }

    public function test_la_route_d_etat_est_protegee(): void
    {
        $route = collect(Route::getRoutes())->first(fn ($r) => $r->uri() === 'api/depenses/etat');
        $this->assertSame(['GET', 'HEAD'], $route->methods());
        $this->assertContains('permission:logistique.access', $route->gatherMiddleware());
        $this->assertContains('auth:sanctum', $route->gatherMiddleware());

        // Un utilisateur simple a l'accès Logistique : il voit l'état, et rien d'autre.
        $simple = $this->utilisateur('user');
        $this->assertTrue($simple->hasPermission('logistique.access'));
        $this->actingAs($simple)->getJson('/api/depenses/etat')->assertOk()->assertExactJson(['suivi_actif' => true]);

        // Un rôle sans l'accès Logistique est refusé.
        $role = Role::create(['name' => 'TEST sans logistique', 'slug' => 'phpunit-sans-logistique', 'description' => 'Rôle de test, sans aucune permission']);
        $sansDroit = $this->utilisateur('phpunit-sans-logistique');
        $this->assertSame($role->id, $sansDroit->role_id);
        $this->actingAs($sansDroit)->getJson('/api/depenses/etat')->assertStatus(403)->assertExactJson(['message' => 'Accès refusé.']);
    }

    public function test_la_route_d_etat_refuse_un_visiteur_non_connecte(): void
    {
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/depenses/etat')->assertStatus(401);
    }

    public function test_la_route_d_etat_ne_gene_pas_les_routes_voisines(): void
    {
        // « etat » n'est pas pris pour un numéro de dépense, et les routes existantes répondent comme avant.
        $this->getJson('/api/achats')->assertOk()->assertJsonStructure(['data', 'total', 'per_page', 'current_page', 'last_page', 'from', 'to']);
        $this->getJson('/api/charges')->assertOk()->assertJsonStructure(['data', 'total', 'per_page', 'current_page', 'last_page', 'from', 'to']);
        $this->postJson('/api/depenses/etat')->assertStatus(405);
    }

    /* ── messages français des validations ── */

    /** Envoie une requête invalide et renvoie ses erreurs, après avoir vérifié la forme de la réponse. */
    private function erreurs(string $methode, string $url, array $corps): array
    {
        $reponse = $this->json($methode, $url, $corps);
        $reponse->assertStatus(422)->assertJsonStructure(['message', 'errors']);
        $erreurs = $reponse->json('errors');

        // Aucun message anglais du cadre Laravel ne doit subsister.
        foreach ($erreurs as $champ => $messages) {
            foreach ($messages as $message) {
                $this->assertDoesNotMatchRegularExpression('/\b(The |field|must be|is required|is invalid|selected)\b/', $message, "{$url} > {$champ} : message non traduit « {$message} »");
            }
        }

        return $erreurs;
    }

    public function test_achat_les_refus_de_validation_sont_en_francais_et_les_regles_sont_inchangees(): void
    {
        $achat = (int) $this->postJson('/api/achats', ['nom_materiel' => 'TEST-EV', 'prix_unitaire' => 1000, 'quantite' => 2, 'date_achat' => '2026-10-01'])->assertStatus(201)->json('id');

        foreach ([['POST', '/api/achats'], ['PUT', "/api/achats/{$achat}"]] as [$methode, $url]) {
            // Tout manque : les quatre champs obligatoires, et eux seuls.
            $this->assertSame([
                'nom_materiel'  => ['Le nom du matériel est obligatoire.'],
                'prix_unitaire' => ['Le prix unitaire est obligatoire.'],
                'quantite'      => ['La quantité est obligatoire.'],
                'date_achat'    => ["La date d'achat est obligatoire."],
            ], $this->erreurs($methode, $url, []));

            // Valeurs invalides : une règle par champ.
            $this->assertSame([
                'nom_materiel'  => ['Le nom du matériel ne doit pas dépasser 255 caractères.'],
                'prix_unitaire' => ['Le prix unitaire doit être un nombre.'],
                'quantite'      => ['La quantité doit être un nombre entier.'],
                'date_achat'    => ["La date d'achat n'est pas une date valide."],
            ], $this->erreurs($methode, $url, ['nom_materiel' => str_repeat('a', 256), 'prix_unitaire' => 'abc', 'quantite' => '1.5', 'date_achat' => 'pas-une-date']));

            $this->assertSame([
                'prix_unitaire' => ['Le prix unitaire ne peut pas être négatif.'],
                'quantite'      => ['La quantité doit être au moins 1.'],
            ], $this->erreurs($methode, $url, ['nom_materiel' => 'TEST-EV', 'prix_unitaire' => -1, 'quantite' => 0, 'date_achat' => '2026-10-01']));
        }

        // Les limites acceptées restent acceptées : prix 0, quantité 1, nom de 255 caractères.
        $this->postJson('/api/achats', ['nom_materiel' => str_repeat('a', 255), 'prix_unitaire' => 0, 'quantite' => 1, 'date_achat' => '2026-10-01'])->assertStatus(201);
        $this->assertSame(2000.0, (float) DB::table('achat')->where('id_achat', $achat)->value('montant'), "L'achat de départ n'a pas été modifié par les requêtes refusées.");
    }

    public function test_charge_les_refus_de_validation_sont_en_francais_et_les_regles_sont_inchangees(): void
    {
        $valide = ['designation' => 'TEST-EV', 'montant' => 2500, 'mois' => 10, 'annee' => 2026, 'date' => '2026-10-01'];
        $charge = (int) $this->postJson('/api/charges', $valide)->assertStatus(201)->json('id');

        foreach ([['POST', '/api/charges'], ['PUT', "/api/charges/{$charge}"]] as [$methode, $url]) {
            $this->assertSame([
                'designation' => ['La désignation est obligatoire.'],
                'montant'     => ['Le montant est obligatoire.'],
                'mois'        => ['Le mois est obligatoire.'],
                'annee'       => ["L'année est obligatoire."],
                'date'        => ['La date est obligatoire.'],
            ], $this->erreurs($methode, $url, []));

            $this->assertSame([
                'designation' => ['La désignation ne doit pas dépasser 255 caractères.'],
                'montant'     => ['Le montant doit être un nombre.'],
                'mois'        => ['Le mois doit être un nombre entre 1 et 12.'],
                'annee'       => ["L'année doit être 2000 ou plus."],
                'date'        => ["La date n'est pas une date valide."],
            ], $this->erreurs($methode, $url, ['designation' => str_repeat('a', 256), 'montant' => 'abc', 'mois' => 13, 'annee' => 1999, 'date' => 'pas-une-date']));

            $this->assertSame([
                'montant' => ['Le montant ne peut pas être négatif.'],
                'mois'    => ['Le mois doit être un nombre entre 1 et 12.'],
                // Un texte viole les deux règles de l'année (entier, puis minimum) : deux messages, comme avant.
                'annee'   => ["L'année doit être un nombre entier.", "L'année doit être 2000 ou plus."],
            ], $this->erreurs($methode, $url, ['montant' => -1, 'mois' => 0, 'annee' => 'abc'] + $valide));
        }

        // Limites acceptées : mois 1 et 12, année 2000, montant 0.
        foreach ([1, 12] as $mois) {
            $this->postJson('/api/charges', ['mois' => $mois, 'annee' => 2000, 'montant' => 0] + $valide)->assertStatus(201);
        }
    }

    public function test_gestion_les_refus_de_validation_sont_en_francais_et_les_regles_sont_inchangees(): void
    {
        $valide = ['compte' => $this->compte, 'type' => 'E', 'montant' => 500, 'raison' => 'TEST-EV dépôt'];
        $this->postJson('/api/gerer', $valide)->assertStatus(201);
        $operation = (int) DB::table('transaction')->where('account', $this->compte)->max('id_transaction');

        foreach ([['POST', '/api/gerer'], ['PUT', "/api/gerer/{$operation}"]] as [$methode, $url]) {
            $this->assertSame([
                'compte'  => ['Choisissez un compte.'],
                'type'    => ["Le type d'opération est obligatoire."],
                'montant' => ['Le montant est obligatoire.'],
                'raison'  => ['Le motif est obligatoire.'],
            ], $this->erreurs($methode, $url, []));

            $this->assertSame([
                'compte'  => ["Le compte choisi n'existe pas."],
                'type'    => ["Le type d'opération doit être un dépôt ou un retrait."],
                'montant' => ['Le montant doit être supérieur à 0.'],
                'raison'  => ['Le motif ne doit pas dépasser 255 caractères.'],
            ], $this->erreurs($methode, $url, ['compte' => 999999999, 'type' => 'X', 'montant' => 0, 'raison' => str_repeat('a', 256)]));

            $this->assertSame(['montant' => ['Le montant doit être un nombre.']], $this->erreurs($methode, $url, ['montant' => 'abc'] + $valide));
        }

        // Rien n'a bougé : une seule opération, de 500, et le solde attendu.
        $this->assertSame(1, DB::table('transaction')->where('account', $this->compte)->count());
        $this->assertSame(50500.0, (float) DB::table('compte')->where('id_compte', $this->compte)->value('montant'));
        // Les refus métier, eux, gardent leur message (ce n'est pas de la validation de champ).
        $this->postJson('/api/gerer', ['type' => 'S', 'montant' => 999999] + $valide)->assertStatus(422)->assertJsonPath('message', 'Solde insuffisant pour ce retrait');
    }

    public function test_virement_les_refus_de_validation_sont_en_francais_et_les_regles_sont_inchangees(): void
    {
        $autre = DB::table('compte')->insertGetId(['account_number' => 'TEST-EV2', 'libelle' => 'TEST ETAT VALIDATIONS 2', 'montant' => 0], 'id_compte');
        $valide = ['starting_account' => $this->compte, 'destination_account' => $autre, 'amount' => 1000];
        $this->postJson('/api/transferts', $valide)->assertStatus(201);
        $virement = (int) DB::table('transfer')->max('id_transfer');

        foreach ([['POST', '/api/transferts'], ['PUT', "/api/transferts/{$virement}"]] as [$methode, $url]) {
            $this->assertSame([
                'starting_account'    => ['Choisissez le compte de départ.'],
                'destination_account' => ['Choisissez le compte de destination.'],
                'amount'              => ['Le montant est obligatoire.'],
            ], $this->erreurs($methode, $url, []));

            $this->assertSame([
                'starting_account'    => ["Le compte de départ n'existe pas."],
                'destination_account' => ["Le compte de destination n'existe pas."],
                'amount'              => ['Le montant doit être supérieur à 0.'],
            ], $this->erreurs($methode, $url, ['starting_account' => 999999998, 'destination_account' => 999999999, 'amount' => 0]));

            $this->assertSame(
                ['starting_account' => ['Le compte de départ et le compte de destination doivent être différents.']],
                $this->erreurs($methode, $url, ['destination_account' => $this->compte] + $valide)
            );
            $this->assertSame(['amount' => ['Le montant doit être un nombre.']], $this->erreurs($methode, $url, ['amount' => 'abc'] + $valide));
        }

        // Rien n'a bougé, et le refus métier garde son message.
        $this->assertSame([49000.0, 1000.0], [(float) DB::table('compte')->where('id_compte', $this->compte)->value('montant'), (float) DB::table('compte')->where('id_compte', $autre)->value('montant')]);
        $this->postJson('/api/transferts', ['amount' => 999999] + $valide)->assertStatus(422)->assertJsonPath('message', 'Solde insuffisant sur le compte de départ');
    }
}
