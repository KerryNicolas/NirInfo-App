<?php

namespace App\Services;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Indicateurs de trésorerie. LECTURE SEULE : ce service n'écrit jamais rien.
 *
 *  - Trésorerie      : somme des soldes des comptes ;
 *  - À valider       : dépenses enregistrées, pas encore validées (information) ;
 *  - Engagé          : dépenses validées, pas encore payées ;
 *  - Décaissé        : dépenses payées, sur une période (date du paiement) ;
 *  - Disponible réel : Trésorerie - Engagé.
 *
 * Une dépense n'a qu'UN statut : elle n'est donc comptée que dans UN seul
 * indicateur à la fois, jamais deux.
 *  - enregistrée : « à valider », ni engagée ni décaissée ;
 *  - validée     : engagée — la trésorerie ne bouge pas, le disponible baisse ;
 *  - payée       : décaissée — elle sort de l'engagé et la trésorerie baisse
 *                  du même montant : le disponible ne bouge pas ;
 *  - annulée     : dans aucun indicateur.
 * Un virement déplace de l'argent entre deux comptes : le total ne change pas.
 *
 * Le disponible réel n'existe que GLOBALEMENT, pas par compte : une dépense
 * validée n'a pas encore de compte, il n'est choisi qu'au paiement.
 *
 * Les indicateurs partent des soldes enregistrés dans la table `compte` : ils
 * valent ce que valent ces soldes.
 */
class IndicateursTresorerieService
{
    private const TABLES = ['achats' => 'achat', 'charges' => 'charge'];

    /**
     * Soldes des comptes. Ne lit que la table `compte`, colonnes d'origine :
     * utilisable sur toute base, migrée ou non.
     */
    public function tresorerie(): array
    {
        $comptes = DB::table('compte')->orderBy('id_compte')
            ->get(['id_compte', 'libelle', 'account_number', 'montant'])
            ->map(fn ($c) => [
                'id_compte'      => (int) $c->id_compte,
                'libelle'        => $c->libelle,
                'account_number' => $c->account_number,
                'solde'          => round((float) $c->montant, 2),   // la colonne est un texte
            ]);

        return [
            'total'            => round($comptes->sum('solde'), 2),
            'comptes'          => $comptes->all(),
            'comptes_negatifs' => $comptes->where('solde', '<', 0)->count(),
        ];
    }

    /**
     * Tous les indicateurs. Suivi de trésorerie ACTIVÉ uniquement : lit les
     * colonnes du suivi (statut, date_paiement, ancien_systeme).
     *
     * @param CarbonInterface $du  premier jour de la période du décaissé (inclus)
     * @param CarbonInterface $au  dernier jour de la période (inclus, jusqu'à 23:59:59)
     */
    public function indicateurs(CarbonInterface $du, CarbonInterface $au): array
    {
        // Une seule transaction : tous les chiffres viennent de la MÊME image
        // de la base. Sans elle, un paiement validé entre deux lectures
        // donnerait une trésorerie déjà diminuée et une dépense encore engagée.
        return DB::transaction(function () use ($du, $au) {
            $tresorerie = $this->tresorerie();
            $aValider   = $this->parStatut(DepenseService::ENREGISTREE);
            $engage     = $this->parStatut(DepenseService::VALIDEE);

            return [
                'tresorerie'      => $tresorerie,
                'a_valider'       => $aValider,
                'engage'          => $engage,
                'decaisse'        => $this->decaisse($du, $au),
                'disponible_reel' => round($tresorerie['total'] - $engage['total'], 2),
            ];
        });
    }

    /** Total et nombre des dépenses d'un statut, avec le détail achats / charges. */
    private function parStatut(string $statut): array
    {
        $detail = [];
        foreach (self::TABLES as $cle => $table) {
            $detail[$cle] = $this->ligne(
                DB::table($table)->where('statut', $statut)->selectRaw('COUNT(*) AS nombre, COALESCE(SUM(montant), 0) AS total')->first()
            );
        }

        return $this->cumul($detail) + $detail;
    }

    /**
     * Dépenses payées dont le paiement tombe dans la période. Les dépenses de
     * l'ancien système (payées avant le suivi) y figurent à la date de leur
     * écriture d'origine, avec un sous-total à part.
     */
    private function decaisse(CarbonInterface $du, CarbonInterface $au): array
    {
        $debut = $du->copy()->startOfDay();
        $fin   = $au->copy()->addDay()->startOfDay();   // borne exclue : le lendemain à 00:00

        $detail  = [];
        $origine = ['suivi' => [], 'ancien_systeme' => []];
        foreach (self::TABLES as $cle => $table) {
            $lignes = DB::table($table)
                ->where('statut', DepenseService::PAYEE)
                ->where('date_paiement', '>=', $debut)
                ->where('date_paiement', '<', $fin)
                ->selectRaw('ancien_systeme, COUNT(*) AS nombre, COALESCE(SUM(montant), 0) AS total')
                ->groupBy('ancien_systeme')
                ->get()->keyBy(fn ($l) => (int) $l->ancien_systeme);

            $origine['suivi'][]          = $this->ligne($lignes->get(0));
            $origine['ancien_systeme'][] = $this->ligne($lignes->get(1));
            $detail[$cle] = $this->cumul([$this->ligne($lignes->get(0)), $this->ligne($lignes->get(1))]);
        }

        return ['du' => $debut->toDateString(), 'au' => $au->toDateString()]
            + $this->cumul($detail) + $detail
            + ['suivi' => $this->cumul($origine['suivi']), 'ancien_systeme' => $this->cumul($origine['ancien_systeme'])];
    }

    private function ligne(?object $l): array
    {
        return ['total' => round((float) ($l->total ?? 0), 2), 'nombre' => (int) ($l->nombre ?? 0)];
    }

    private function cumul(array $lignes): array
    {
        return [
            'total'  => round(array_sum(array_column($lignes, 'total')), 2),
            'nombre' => array_sum(array_column($lignes, 'nombre')),
        ];
    }
}
