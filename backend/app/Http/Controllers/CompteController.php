<?php
namespace App\Http\Controllers;

use App\Services\DepenseService;
use App\Services\TresorerieService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CompteController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('compte as c')
            ->leftJoin('users as u', 'c.matricule_s', '=', 'u.id')
            ->select(
                'c.id_compte', 'c.account_number', 'c.libelle', 'c.montant',
                DB::raw("IFNULL(u.name, '') as editeur")
            );

        return $this->paginate($query, $request,
            ['c.account_number', 'c.libelle'],
            'c.id_compte'
        );
    }

    // ─── Liste simple pour les select (réutilisé par Prestation/Inscription/etc.) ──
    public function simple()
    {
        return response()->json(
            DB::table('compte')->select('id_compte', 'libelle', 'account_number')->get()
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'account_number' => 'required|string|max:100',
            'libelle'        => 'required|string|max:255',
        ]);

        $id = DB::table('compte')->insertGetId([
            'account_number' => $request->account_number,
            'libelle'        => $request->libelle,
            'montant'        => 0,
            'matricule_s'    => auth()->id(),
        ]);

        return $this->ok('Compte créé avec succès', ['id_compte' => $id], 201);
    }

    public function update(Request $request, $id)
    {
        $request->validate([
            'account_number' => 'required|string|max:100',
            'libelle'        => 'required|string|max:255',
        ]);

        DB::table('compte')->where('id_compte', $id)->update([
            'account_number' => $request->account_number,
            'libelle'        => $request->libelle,
        ]);
        return $this->ok('Compte mis à jour avec succès');
    }

    public function destroy($id)
    {
        // FIX : un compte encore utilisé par une opération financière (écriture
        // du journal ou virement — et dépense, si le suivi est activé) ne se
        // supprime plus : ses écritures resteraient sans compte. TOUJOURS
        // appliqué, que le suivi des dépenses soit activé ou non.
        //
        // Dans UNE transaction, le compte étant verrouillé d'abord : une
        // opération en cours sur ce compte (qui le verrouille aussi, via
        // TresorerieService) se termine avant le contrôle, qui voit alors son
        // écriture. Le verrou doit rester la PREMIÈRE lecture de la transaction.
        return DB::transaction(function () use ($id) {
            DB::table('compte')->where('id_compte', $id)->lockForUpdate()->first();

            $utilise = app(TresorerieService::class)->compteUtilise((int) $id)
                || (DepenseService::actif() && app(DepenseService::class)->compteUtiliseParDepense((int) $id));

            if ($utilise) {
                return $this->err('Ce compte est utilisé par des opérations financières : il ne peut pas être supprimé.', 422);
            }

            DB::table('compte')->where('id_compte', $id)->delete();

            return $this->ok('Compte supprimé avec succès');
        });
    }
}