<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

// Totaux et export des listes d'achats et de charges (Logistique).
//  - total_montant : somme de TOUTES les lignes qui répondent aux filtres et à
//    la recherche, quelle que soit la page demandée ;
//  - total_actif   : suivi activé uniquement — les mêmes lignes, sans les
//    dépenses annulées ;
//  - export        : toutes ces lignes, leur nombre et leurs totaux, dans une
//    seule réponse lue dans une seule transaction.
// L'écran additionnait auparavant les seules lignes de la page affichée, et
// n'exportait qu'elles.
class TotauxLogistiqueTest extends TestCase
{
    private const MARQUE = 'TEST-TOTAUX';

    /** Champs d'une ligne quand le suivi est désactivé : ceux d'avant le suivi. */
    private const CHAMPS_D_ORIGINE = [
        'achats'  => ['id_achat', 'nom_materiel', 'prix_unitaire', 'quantite', 'montant', 'date_achat', 'photo_achat', 'editeur'],
        'charges' => ['id_charge', 'designation', 'montant', 'mois', 'annee', 'date', 'photo_charge', 'editeur'],
    ];

    /** Combinaisons de filtres appliquées à deux dépenses marquées : 1 000 Ar le 10/03/2031 et 2 500 Ar le 05/04/2031. */
    private const FILTRES = [
        'recherche seule'        => [[], 3500.0, 2],
        'mars 2031'              => [['mois' => 3, 'annee' => 2031], 1000.0, 1],
        'avril 2031'             => [['mois' => 4, 'annee' => 2031], 2500.0, 1],
        'année 2031'             => [['annee' => 2031], 3500.0, 2],
        'mois de mars'           => [['mois' => 3], 1000.0, 1],
        'année sans dépense'     => [['annee' => 2032], 0.0, 0],
        'du 1er au 31 mars'      => [['date_debut' => '2031-03-01', 'date_fin' => '2031-03-31'], 1000.0, 1],
        'à partir du 1er avril'  => [['date_debut' => '2031-04-01'], 2500.0, 1],
        "jusqu'au 10 mars"       => [['date_fin' => '2031-03-10'], 1000.0, 1],
        'mois et dates ensemble' => [['mois' => 4, 'annee' => 2031, 'date_debut' => '2031-03-01', 'date_fin' => '2031-03-31'], 0.0, 0],
    ];

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::whereHas('roleRelation', fn ($q) => $q->where('slug', 'admin'))->firstOrFail();
        $this->actingAs($this->admin);
    }

    /** [route, table, clé primaire] */
    public static function listes(): array
    {
        return ['achats' => ['achats', 'achat', 'id_achat'], 'charges' => ['charges', 'charge', 'id_charge']];
    }

    /* ── outils ── */

    /** Saisit une dépense marquée (ou au libellé donné) à la date donnée ; une charge porte aussi le mois et l'année de cette date. */
    private function saisir(string $route, int $montant, string $date, string $libelle = self::MARQUE): int
    {
        $corps = $route === 'achats'
            ? ['nom_materiel' => $libelle, 'prix_unitaire' => $montant, 'quantite' => 1, 'date_achat' => $date]
            : ['designation' => $libelle, 'montant' => $montant, 'mois' => (int) substr($date, 5, 2), 'annee' => (int) substr($date, 0, 4), 'date' => $date];

        return (int) $this->postJson("/api/{$route}", $corps)->assertStatus(201)->json('id');
    }

    private function liste(string $route, array $parametres = []): array
    {
        return $this->getJson("/api/{$route}?" . http_build_query($parametres))->assertOk()->json();
    }

    private function export(string $route, array $parametres = []): array
    {
        return $this->getJson("/api/{$route}/export?" . http_build_query($parametres))->assertOk()->json();
    }

    /** [total_montant, total_actif] des seules dépenses marquées, avec d'éventuels filtres. */
    private function totauxMarques(string $route, array $filtres = []): array
    {
        $r = $this->liste($route, ['search' => self::MARQUE] + $filtres);

        return [(float) $r['total_montant'], (float) $r['total_actif']];
    }

    /** Toutes les lignes de la LISTE pour ces paramètres, en parcourant toutes ses pages (200 lignes par page). */
    private function lignesDeLaListe(string $route, array $parametres = []): array
    {
        $lignes = [];
        $page = 1;
        do {
            $r = $this->liste($route, ['per_page' => 200, 'page' => $page] + $parametres);
            $lignes = array_merge($lignes, $r['data']);
            $page++;
        } while ($page <= $r['last_page']);

        return $lignes;
    }

    /** Un export se tient : nombre annoncé = lignes reçues, numéros uniques et décroissants, totaux = somme des lignes. */
    private function assertExportCoherent(array $export, string $cle, string $contexte): void
    {
        $numeros = array_column($export['data'], $cle);

        $this->assertSame($export['total'], count($export['data']), "{$contexte} : le nombre annoncé est celui des lignes envoyées.");
        $this->assertSame(count($numeros), count(array_unique($numeros)), "{$contexte} : aucune ligne en double.");
        $tries = $numeros;
        rsort($tries);
        $this->assertSame($tries, $numeros, "{$contexte} : lignes triées par numéro décroissant.");

        $somme = array_sum(array_column($export['data'], 'montant'));
        $this->assertEqualsWithDelta((float) $export['total_montant'], (float) $somme, 0.001, "{$contexte} : total_montant = somme des lignes.");

        if (array_key_exists('total_actif', $export)) {
            $actif = array_sum(array_column(array_filter($export['data'], fn ($l) => ($l['statut'] ?? '') !== 'annulee'), 'montant'));
            $this->assertEqualsWithDelta((float) $export['total_actif'], (float) $actif, 0.001, "{$contexte} : total_actif = somme des lignes non annulées.");
        }
    }

    /* ═══════════ TOTAUX DE LA LISTE ═══════════ */

    #[DataProvider('listes')]
    public function test_sans_filtre_le_total_est_celui_de_toute_la_liste_pas_de_la_page(string $route, string $table, string $cle): void
    {
        $r = $this->liste($route);
        $somme = (float) DB::table($table)->sum('montant');

        $this->assertSame($somme, (float) $r['total_montant'], 'Total = somme SQL de toutes les lignes.');
        $this->assertSame(DB::table($table)->count(), $r['total']);
        // La base de test ne contient aucune dépense annulée : les deux totaux sont égaux.
        $this->assertSame($somme, (float) $r['total_actif']);

        // Dès que la liste dépasse une page, le total n'est PAS la somme des lignes affichées (l'ancien calcul).
        if ($r['total'] > count($r['data'])) {
            $this->assertNotEquals((float) array_sum(array_column($r['data'], 'montant')), (float) $r['total_montant']);
        }
    }

    #[DataProvider('listes')]
    public function test_le_total_ne_depend_ni_de_la_page_ni_du_nombre_de_lignes_par_page(string $route, string $table, string $cle): void
    {
        $reference = $this->liste($route);
        $attendu = [(float) $reference['total_montant'], (float) $reference['total_actif']];

        foreach ([['page' => 2], ['per_page' => 1], ['per_page' => 1, 'page' => 3], ['per_page' => 200], ['page' => 9999]] as $parametres) {
            $r = $this->liste($route, $parametres);
            $this->assertSame($attendu, [(float) $r['total_montant'], (float) $r['total_actif']], json_encode($parametres));
            $this->assertSame($reference['total'], $r['total'], json_encode($parametres));
        }
    }

    #[DataProvider('listes')]
    public function test_la_reponse_garde_sa_pagination_et_ajoute_seulement_les_deux_totaux(string $route, string $table, string $cle): void
    {
        $r = $this->liste($route, ['per_page' => 2]);

        // Les sept champs d'origine, dans le même ordre, puis les deux totaux.
        $this->assertSame(['data', 'total', 'per_page', 'current_page', 'last_page', 'from', 'to', 'total_montant', 'total_actif'], array_keys($r));
        $this->assertCount(2, $r['data']);
        $this->assertSame([2, 1, 1, 2], [$r['per_page'], $r['current_page'], $r['from'], $r['to']]);
        // Aucun total ne se glisse dans les lignes elles-mêmes, et la colonne interne ne sort pas.
        $this->assertArrayNotHasKey('total_montant', $r['data'][0]);
        $this->assertArrayNotHasKey('_auteur', $r['data'][0]);
    }

    #[DataProvider('listes')]
    public function test_la_recherche_limite_la_liste_et_le_total_aux_lignes_trouvees(string $route, string $table, string $cle): void
    {
        $this->saisir($route, 1000, '2031-03-10');
        $this->saisir($route, 2500, '2031-04-05');

        $r = $this->liste($route, ['search' => self::MARQUE, 'per_page' => 1]);
        $this->assertSame(2, $r['total']);
        $this->assertCount(1, $r['data'], 'Une seule ligne par page…');
        $this->assertSame([3500.0, 3500.0], [(float) $r['total_montant'], (float) $r['total_actif']], '…mais le total porte sur les deux.');

        // La recherche est un « contient », insensible à la position : comme avant.
        $this->assertSame(2, $this->liste($route, ['search' => 'ST-TOTAU'])['total']);

        $vide = $this->liste($route, ['search' => 'AUCUN-RESULTAT-POSSIBLE-XYZ']);
        $this->assertSame([[], 0, 0.0, 0.0], [$vide['data'], $vide['total'], (float) $vide['total_montant'], (float) $vide['total_actif']]);
    }

    #[DataProvider('listes')]
    public function test_les_filtres_de_mois_d_annee_et_de_dates_limitent_la_liste_et_le_total(string $route, string $table, string $cle): void
    {
        $this->saisir($route, 1000, '2031-03-10');
        $this->saisir($route, 2500, '2031-04-05');

        foreach (self::FILTRES as $cas => [$filtres, $total, $nombre]) {
            $r = $this->liste($route, ['search' => self::MARQUE] + $filtres);
            $this->assertSame($nombre, $r['total'], "{$cas} : nombre de lignes");
            $this->assertSame($total, (float) $r['total_montant'], "{$cas} : total");
            $this->assertSame($total, (float) array_sum(array_column($r['data'], 'montant')), "{$cas} : la liste et le total disent la même chose");
        }
    }

    public function test_sans_recherche_le_filtre_par_mois_et_annee_des_achats_egale_la_somme_sql(): void
    {
        // Le filtre porte sur toute la base, données historiques comprises.
        $dernier = DB::table('achat')->orderByDesc('date_achat')->value('date_achat');
        [$annee, $mois] = [(int) substr($dernier, 0, 4), (int) substr($dernier, 5, 2)];
        $sql = DB::table('achat')->whereYear('date_achat', $annee)->whereMonth('date_achat', $mois);

        $r = $this->liste('achats', ['mois' => $mois, 'annee' => $annee]);

        $this->assertSame((float) (clone $sql)->sum('montant'), (float) $r['total_montant']);
        $this->assertSame((clone $sql)->count(), $r['total']);
        $this->assertLessThan(DB::table('achat')->count(), $r['total'], 'Le filtre a réellement réduit la liste.');
    }

    #[DataProvider('listes')]
    public function test_une_depense_annulee_sort_du_total_actif_mais_reste_dans_le_total_enregistre(string $route, string $table, string $cle): void
    {
        $annulee = $this->saisir($route, 1000, '2031-03-10');
        $payee   = $this->saisir($route, 2500, '2031-03-11');
        $this->saisir($route, 400, '2031-03-12');                       // reste « enregistrée »
        $this->assertSame([3900.0, 3900.0], $this->totauxMarques($route));

        $this->postJson("/api/{$route}/{$annulee}/annuler", ['motif' => 'TEST totaux'])->assertStatus(200);
        $this->assertSame([3900.0, 2900.0], $this->totauxMarques($route), 'Annulée : hors du total actif, toujours dans le total enregistré.');

        // Validée puis payée : toujours comptée dans les deux totaux.
        $compte = DB::table('compte')->insertGetId(['account_number' => 'TEST-TT', 'libelle' => 'TEST TOTAUX', 'montant' => 50000], 'id_compte');
        $this->postJson("/api/{$route}/{$payee}/valider")->assertStatus(200);
        $this->assertSame([3900.0, 2900.0], $this->totauxMarques($route), 'Validée.');
        $this->postJson("/api/{$route}/{$payee}/payer", ['id_compte' => $compte])->assertStatus(200);
        $this->assertSame([3900.0, 2900.0], $this->totauxMarques($route), 'Payée.');

        // Les filtres s'appliquent aux deux totaux de la même façon.
        $this->assertSame([1000.0, 0.0], $this->totauxMarques($route, ['date_debut' => '2031-03-10', 'date_fin' => '2031-03-10']));
        $this->assertSame([2900.0, 2900.0], $this->totauxMarques($route, ['date_debut' => '2031-03-11']));

        // L'export dit la même chose, ligne par ligne : la dépense annulée y figure, avec son statut.
        $export = $this->export($route, ['search' => self::MARQUE]);
        $this->assertSame([3, 3900.0, 2900.0], [$export['total'], (float) $export['total_montant'], (float) $export['total_actif']]);
        $this->assertSame(['enregistree', 'payee', 'annulee'], array_column($export['data'], 'statut'));
        $this->assertExportCoherent($export, $cle, 'après annulation');
    }

    #[DataProvider('listes')]
    public function test_suivi_desactive_un_seul_total_et_aucune_colonne_du_suivi_n_est_lue(string $route, string $table, string $cle): void
    {
        $annulee = $this->saisir($route, 1000, '2031-03-10');
        $this->saisir($route, 2500, '2031-04-05');
        $this->postJson("/api/{$route}/{$annulee}/annuler", ['motif' => 'TEST totaux'])->assertStatus(200);

        config(['depenses.workflow' => false]);
        DB::flushQueryLog();
        DB::enableQueryLog();
        $r      = $this->liste($route, ['search' => self::MARQUE, 'mois' => 3, 'annee' => 2031]);
        $tout   = $this->liste($route, ['search' => self::MARQUE]);
        $export = $this->export($route, ['search' => self::MARQUE]);
        $sql = implode("\n", array_column(DB::getQueryLog(), 'query'));
        DB::disableQueryLog();

        // Liste : les sept champs d'origine et le total général ; pas de total actif.
        $this->assertSame(['data', 'total', 'per_page', 'current_page', 'last_page', 'from', 'to', 'total_montant'], array_keys($r));
        $this->assertSame(1000.0, (float) $r['total_montant'], 'Le filtre par mois et année fonctionne aussi suivi désactivé.');
        // Comportement d'avant le suivi : toutes les lignes comptent, la notion d'annulation n'existe pas.
        $this->assertSame(3500.0, (float) $tout['total_montant']);

        // Export : mêmes règles, et les lignes n'ont que leurs champs d'origine.
        $this->assertSame(['data', 'total', 'total_montant'], array_keys($export));
        $this->assertSame([2, 3500.0], [$export['total'], (float) $export['total_montant']]);
        $this->assertSame(self::CHAMPS_D_ORIGINE[$route], array_keys($export['data'][0]));
        $this->assertExportCoherent($export, $cle, 'suivi désactivé');

        foreach (['statut', 'ancien_systeme', 'id_compte', 'date_paiement', 'date_validation', 'depense_evenements'] as $interdit) {
            $this->assertStringNotContainsString($interdit, $sql, "Suivi désactivé : « {$interdit} » ne doit pas être lu.");
        }
    }

    /* ═══════════ EXPORT ═══════════ */

    #[DataProvider('listes')]
    public function test_l_export_contient_exactement_les_lignes_de_la_liste_entiere(string $route, string $table, string $cle): void
    {
        $export = $this->export($route);
        $liste  = $this->lignesDeLaListe($route);

        // Une réponse, quatre champs.
        $this->assertSame(['data', 'total', 'total_montant', 'total_actif'], array_keys($export));
        $this->assertSame(DB::table($table)->count(), $export['total']);
        $this->assertGreaterThan(15, $export['total'], "L'export dépasse la page de 15 lignes qui était seule exportée auparavant.");

        // Les mêmes lignes que la liste parcourue page par page : mêmes numéros, même ordre, mêmes champs, mêmes valeurs.
        $this->assertSame($liste, $export['data']);
        $this->assertArrayNotHasKey('_auteur', $export['data'][0]);
        $this->assertArrayHasKey('est_auteur', $export['data'][0]);

        // Et les mêmes totaux que la liste.
        $r = $this->liste($route);
        $this->assertSame([(float) $r['total_montant'], (float) $r['total_actif']], [(float) $export['total_montant'], (float) $export['total_actif']]);
        $this->assertExportCoherent($export, $cle, 'sans filtre');
    }

    #[DataProvider('listes')]
    public function test_l_export_applique_les_memes_filtres_et_la_meme_recherche_que_la_liste(string $route, string $table, string $cle): void
    {
        $this->saisir($route, 1000, '2031-03-10');
        $this->saisir($route, 2500, '2031-04-05');

        foreach (self::FILTRES as $cas => [$filtres, $total, $nombre]) {
            $parametres = ['search' => self::MARQUE] + $filtres;
            $export = $this->export($route, $parametres);

            $this->assertSame([$nombre, $total], [$export['total'], (float) $export['total_montant']], "{$cas} : nombre et total");
            $this->assertSame($this->lignesDeLaListe($route, $parametres), $export['data'], "{$cas} : mêmes lignes que la liste");
            $this->assertExportCoherent($export, $cle, $cas);
        }

        // Un filtre sans recherche, sur les données historiques : mêmes lignes que la liste.
        $annee = (int) substr((string) DB::table($table)->max($route === 'achats' ? 'date_achat' : 'date'), 0, 4);
        $export = $this->export($route, ['annee' => $annee]);
        $this->assertSame($this->lignesDeLaListe($route, ['annee' => $annee]), $export['data']);
        $this->assertExportCoherent($export, $cle, "année {$annee}");
    }

    #[DataProvider('listes')]
    public function test_l_export_renvoie_intacts_les_textes_a_point_virgule_guillemet_et_retour_a_la_ligne(string $route, string $table, string $cle): void
    {
        // Les caractères qui cassent un CSV mal écrit. Le serveur doit les rendre tels quels :
        // c'est l'écran qui les protège en fabriquant le fichier (frontend/src/utils/csv.ts).
        $textes = [
            self::MARQUE . ' fournitures ; papier ; encre',
            self::MARQUE . ' câble "RJ45" 5 m',
            self::MARQUE . " ligne 1\nligne 2",
            self::MARQUE . ' ; "tout" à la fois',
        ];
        foreach ($textes as $i => $texte) {
            $this->saisir($route, 100 * ($i + 1), '2031-03-10', $texte);
        }

        $export = $this->export($route, ['search' => self::MARQUE]);

        // De la plus récente à la plus ancienne, sans aucune altération.
        $this->assertSame(array_reverse($textes), array_column($export['data'], $route === 'achats' ? 'nom_materiel' : 'designation'));
        $this->assertSame([4, 1000.0], [$export['total'], (float) $export['total_montant']]);
        $this->assertSame($this->lignesDeLaListe($route, ['search' => self::MARQUE]), $export['data']);
        $this->assertExportCoherent($export, $cle, 'caractères spéciaux');
    }

    #[DataProvider('listes')]
    public function test_l_export_lit_tout_dans_une_seule_transaction(string $route, string $table, string $cle): void
    {
        $niveauDuTest = DB::transactionLevel();
        $lectures = [];
        DB::listen(function ($requete) use (&$lectures, $table) {
            if (str_contains($requete->sql, "`{$table}`")) {
                $lectures[] = [DB::transactionLevel(), strtok($requete->sql, ' ')];
            }
        });

        $this->export($route, ['search' => 'a']);
        $pendant = $lectures;
        $this->liste($route, ['search' => 'a']);
        $liste = array_slice($lectures, count($pendant));

        foreach (['export' => $pendant, 'liste' => $liste] as $quoi => $requetes) {
            // Nombre de lignes, total, total actif et lignes : au moins quatre lectures…
            $this->assertGreaterThanOrEqual(4, count($requetes), "{$quoi} : nombre de lectures");
            // …toutes des lectures, toutes dans la même transaction, ouverte en plus de celle du test.
            $this->assertSame(['select'], array_values(array_unique(array_column($requetes, 1))), "{$quoi} : uniquement des lectures");
            $this->assertSame([$niveauDuTest + 1], array_values(array_unique(array_column($requetes, 0))), "{$quoi} : une seule transaction pour toutes les lectures");
        }
        $this->assertSame($niveauDuTest, DB::transactionLevel(), 'La transaction de lecture est refermée.');
    }

    #[DataProvider('listes')]
    public function test_au_dela_du_plafond_l_export_est_refuse_en_francais_sans_aucune_ligne(string $route, string $table, string $cle): void
    {
        $this->saisir($route, 1000, '2031-03-10');
        $this->saisir($route, 2500, '2031-04-05');
        $this->saisir($route, 400, '2031-04-06');
        config(['depenses.export_max' => 2]);

        // Trois lignes pour un plafond de deux : refus, message en français, aucune donnée.
        $refus = $this->getJson("/api/{$route}/export?search=" . self::MARQUE)->assertStatus(422);
        $refus->assertExactJson(['message' => "L'export est limité à 2 lignes, et 3 lignes correspondent à ces filtres. Réduisez la période ou précisez la recherche."]);

        // Exactement le plafond : accepté.
        $export = $this->export($route, ['search' => self::MARQUE, 'annee' => 2031, 'mois' => 4]);
        $this->assertSame(2, $export['total']);
        $this->assertExportCoherent($export, $cle, 'au plafond');

        // La liste paginée, elle, n'est pas concernée par le plafond.
        $this->assertSame(3, $this->liste($route, ['search' => self::MARQUE])['total']);
    }

    /* ═══════════ DROITS ═══════════ */

    #[DataProvider('listes')]
    public function test_l_export_a_les_memes_droits_que_la_liste(string $route, string $table, string $cle): void
    {
        // Les deux routes sont des lectures, protégées par la connexion, comme les listes.
        foreach (["api/{$route}", "api/{$route}/export"] as $uri) {
            $r = collect(Route::getRoutes())->first(fn ($x) => $x->uri() === $uri && in_array('GET', $x->methods(), true));
            $this->assertNotNull($r, $uri);
            $this->assertSame(['GET', 'HEAD'], $r->methods(), $uri);
            $this->assertContains('auth:sanctum', $r->gatherMiddleware(), $uri);
        }
        $this->postJson("/api/{$route}/export")->assertStatus(405);

        // Un utilisateur simple voit la liste : il peut l'exporter, et reçoit les mêmes lignes.
        $simple = $this->admin->replicate();
        $simple->name = 'TEST totaux simple'; $simple->email = 'phpunit-totaux-simple@test.local'; $simple->matricule = 'TEST-PHPUNIT-TT';
        $simple->role_id = Role::where('slug', 'user')->firstOrFail()->id;
        $simple->save();
        $this->actingAs($simple->fresh());
        $this->assertSame($this->liste($route, ['per_page' => 5])['data'], array_slice($this->export($route)['data'], 0, 5));
    }

    public function test_un_visiteur_non_connecte_ne_recoit_ni_total_ni_export(): void
    {
        $this->app['auth']->forgetGuards();

        foreach (['/api/achats', '/api/charges', '/api/achats/export', '/api/charges/export'] as $url) {
            $this->getJson($url)->assertStatus(401)->assertJsonMissingPath('total_montant')->assertJsonMissingPath('data');
        }
    }
}
