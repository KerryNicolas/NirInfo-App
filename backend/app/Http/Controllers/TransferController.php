<?php
namespace App\Http\Controllers;

use App\Services\DepenseService;
use App\Services\TresorerieService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Virements entre comptes. La logique (verrous, contrôle du solde, écritures
// au journal) est dans App\Services\TresorerieService :
//  - TOUJOURS : les comptes sont verrouillés, leur existence et le solde sont
//    contrôlés sous verrou, dans une seule transaction SQL ;
//  - si le suivi de trésorerie est activé (config/depenses.php) : chaque
//    virement écrit deux écritures liées au journal, et se modifie ou se
//    supprime par compensation, sans rien effacer du journal.
// Une erreur inattendue donne un message en français, sans détail technique
// (voir BaseApiController::proteger).
class TransferController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('transfer as t')
            ->join('compte as c1', 't.starting_account',   '=', 'c1.id_compte')
            ->join('compte as c2', 't.destination_account', '=', 'c2.id_compte')
            ->select(
                't.id_transfer',
                't.starting_account',
                't.destination_account',
                't.amount',
                'c1.account_number as starting_number',
                'c1.libelle        as starting_libelle',
                'c2.account_number as destination_number',
                'c2.libelle        as destination_libelle'
            );

        return $this->paginate($query, $request,
            ['c1.libelle', 'c2.libelle', 'c1.account_number', 'c2.account_number'],
            't.id_transfer'
        );
    }

    public function store(Request $request)
    {
        $this->valider($request);

        // FIX : le solde était vérifié AVANT la transaction et sans verrou —
        // deux virements simultanés pouvaient vider deux fois le même compte.
        return $this->proteger('Erreur lors du virement', function () use ($request) {
            $this->tresorerie()->creerVirement(
                (int) $request->starting_account, (int) $request->destination_account, (float) $request->amount,
                auth()->id(), DepenseService::actif()
            );

            return $this->ok('Virement effectué avec succès', [], 201);
        });
    }

    // Modification d'un virement : l'ancien mouvement est intégralement annulé,
    // puis le nouveau est appliqué — jamais de double comptabilisation, tout
    // dans une seule transaction. Seul l'effet NET sur chaque solde est contrôlé.
    public function update(Request $request, $id)
    {
        $this->valider($request);

        return $this->proteger('Erreur lors de la modification', function () use ($request, $id) {
            $this->tresorerie()->modifierVirement(
                (int) $id, (int) $request->starting_account, (int) $request->destination_account, (float) $request->amount,
                auth()->id(), DepenseService::actif()
            );

            return $this->ok('Virement mis à jour avec succès — les soldes ont été recalculés');
        });
    }

    // Suppression : le mouvement est annulé (les soldes des deux comptes sont
    // rétablis) avant de supprimer la ligne. Refusée si le compte d'arrivée a
    // déjà dépensé l'argent reçu : il deviendrait négatif.
    public function destroy($id)
    {
        return $this->proteger('Erreur lors de la suppression', function () use ($id) {
            $this->tresorerie()->supprimerVirement((int) $id, auth()->id(), DepenseService::actif());

            return $this->ok('Supprimé avec succès — les soldes des comptes ont été réajustés');
        });
    }

    private function valider(Request $request): void
    {
        $request->validate([
            'starting_account'    => 'required|integer|exists:compte,id_compte|different:destination_account',
            'destination_account' => 'required|integer|exists:compte,id_compte',
            'amount'              => 'required|numeric|min:1',
        ], [
            // Messages français : les règles ne changent pas, seul le texte des refus (422) est traduit.
            'starting_account.required'    => 'Choisissez le compte de départ.',
            'starting_account.integer'     => "Le compte de départ n'existe pas.",
            'starting_account.exists'      => "Le compte de départ n'existe pas.",
            'starting_account.different'   => 'Le compte de départ et le compte de destination doivent être différents.',
            'destination_account.required' => 'Choisissez le compte de destination.',
            'destination_account.integer'  => "Le compte de destination n'existe pas.",
            'destination_account.exists'   => "Le compte de destination n'existe pas.",
            'amount.required'              => 'Le montant est obligatoire.',
            'amount.numeric'               => 'Le montant doit être un nombre.',
            'amount.min'                   => 'Le montant doit être supérieur à 0.',
        ]);
    }

    private function tresorerie(): TresorerieService
    {
        return app(TresorerieService::class);
    }
}
