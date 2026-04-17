<?php
namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RecouvrementController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('inscription as i')
            ->join('etudiant as e',      'i.matricule_etudiant','=','e.matricule_etudiant')
            ->leftJoin('salarie as sal',  'i.matricule_s',       '=','sal.matricule_s')
            ->select(
                'i.id_paiement        as id_recouvrement',
                'i.matricule_etudiant as matricule',
                'e.nom_etudiant       as nom',
                'e.prenom_etudiant    as prenom',
                'i.code_session',
                'i.date_paiement',
                'i.montant_paye',
                'i.reste_a_payer      as reste',
                'i.type_paiement      as compte',
                'i.lieu_paiement',
                DB::raw("CONCAT(IFNULL(sal.nom_s,''),' ',IFNULL(sal.prenom_s,'')) as editeur")
            )
            ->where('i.reste_a_payer','>',0);
        // LIFO : id_paiement DESC
        return $this->paginate($query, $request,
            ['i.matricule_etudiant','e.nom_etudiant','i.code_session'],
            'i.id_paiement'
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'matricule'    => 'required|string',
            'code_session' => 'required|string',
            'montant_paye' => 'required|numeric|min:1',
        ]);
        $original = DB::table('inscription')
            ->where('matricule_etudiant',$request->matricule)
            ->where('code_session',$request->code_session)
            ->orderBy('id_paiement','DESC')->first();

        if (!$original) return $this->err('Inscription non trouvée', 404);

        $nouveauReste = max(0, floatval($original->reste_a_payer) - floatval($request->montant_paye));
        $lastTx       = DB::table('inscription')->max('id_transaction') ?? 0;

        DB::table('inscription')->insert([
            'matricule_etudiant' => $request->matricule,
            'code_session'       => $request->code_session,
            'date_paiement'      => $request->date_paiement ?? now(),
            'montant_paye'       => $request->montant_paye,
            'type_paiement'      => $request->compte        ?? 'Caisse',
            'lieu_paiement'      => $request->lieu_paiement ?? 'Ampandrana',
            'reste_a_payer'      => $nouveauReste,
            'ref_facture'        => 0,
            'id_transaction'     => $lastTx + 1,
        ]);
        DB::table('inscription')->where('id_paiement',$original->id_paiement)
            ->update(['reste_a_payer'=>$nouveauReste]);

        return $this->ok('Recouvrement enregistré avec succès', [], 201);
    }

    public function show($id)
    {
        return response()->json(DB::table('inscription')->where('id_paiement',$id)->first());
    }

    public function update(Request $request, $id)
    {
        DB::table('inscription')->where('id_paiement',$id)->update([
            'montant_paye'  => $request->montant_paye,
            'reste_a_payer' => $request->reste ?? 0,
            'type_paiement' => $request->compte,
            'lieu_paiement' => $request->lieu_paiement,
        ]);
        return $this->ok('Recouvrement mis à jour');
    }

    public function destroy($id)
    {
        DB::table('inscription')->where('id_paiement',$id)->delete();
        return $this->ok('Supprimé');
    }
}