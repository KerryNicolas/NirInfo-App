<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CertificationController extends BaseApiController
{
    public function index(Request $request)
    {
        try {
            $query = DB::table('certificat as c')
                ->leftJoin('etudiant as e', 'c.matricule',   '=', 'e.matricule_etudiant')
                ->leftJoin('module as m',   'c.code_module', '=', 'm.code_module')
                ->leftJoin('salarie as s',  'c.matricule_s', '=', 's.matricule_s')
                ->select(
                    'c.id',
                    'c.reference',
                    'c.matricule',
                    DB::raw("IFNULL(e.nom_etudiant,'')     as nom"),
                    DB::raw("IFNULL(e.prenom_etudiant,'')  as prenom"),
                    DB::raw("CONCAT(IFNULL(e.nom_etudiant,''),' ',IFNULL(e.prenom_etudiant,'')) as nom_complet"),
                    'c.code_module',
                    DB::raw("IFNULL(c.nom_formation, m.nom_module) as module_nom"),
                    'c.debut_session',
                    'c.fin_session',
                    'c.date',
                    'c.accept',
                    'c.prix',
                    'c.lieu_paiement',
                    'c.code_session',
                    DB::raw("CONCAT(IFNULL(s.nom_s,''),' ',IFNULL(s.prenom_s,'')) as editeur")
                );

            // LIFO : id DESC — le dernier certificat généré en premier
            return $this->paginate($query, $request,
                ['c.matricule', 'e.nom_etudiant', 'e.prenom_etudiant', 'c.reference', 'c.code_module'],
                'c.id'
            );
        } catch (\Exception $e) {
            return response()->json(['data' => [], 'total' => 0, 'error' => $e->getMessage()], 500);
        }
    }

    public function store(Request $request)
    {
        $request->validate([
            'matricule'   => 'required|string|exists:etudiant,matricule_etudiant',
            'code_module' => 'required|string',
        ]);

        // Référence unique basée sur le dernier id
        $last      = DB::table('certificat')->orderBy('id', 'DESC')->first();
        $num       = $last ? ($last->id + 1) : 1;
        $reference = 'CERT-' . date('Y') . '-' . str_pad($num, 4, '0', STR_PAD_LEFT);

        $session = null;
        if ($request->filled('code_session')) {
            $session = DB::table('session')->where('code_session', $request->code_session)->first();
        }

        DB::table('certificat')->insert([
            'reference'     => $reference,
            'matricule'     => $request->matricule,
            'code_module'   => $request->code_module,
            'debut_session' => $request->date_debut  ?? ($session?->debut_session ?? now()->toDateString()),
            'fin_session'   => $request->date_fin    ?? ($session?->fin_session   ?? now()->toDateString()),
            'nom_formation' => $request->nom_formation_certificat ?? null,
            'lieu_paiement' => $request->lieu_paiement ?? null,
            'code_session'  => $request->code_session  ?? null,
            'accept'        => 1,
            'prix'          => $request->prix ?? null,
            'date'          => now(),
        ]);

        return response()->json(['message' => 'Certificat généré', 'reference' => $reference], 201);
    }

    public function show($id)
    {
        $c = DB::table('certificat')->where('reference', $id)->first();
        if (!$c) return $this->err('Non trouvé', 404);
        return response()->json($c);
    }

    public function destroy($id)
    {
        DB::table('certificat')->where('reference', $id)->delete();
        return $this->ok('Certificat supprimé');
    }

    public function montant(Request $request)
    {
        try {
            $query = DB::table('certificat')->whereNotNull('prix')->where('accept', 1);
            if ($request->filled('date_debut')) $query->whereDate('date', '>=', $request->date_debut);
            if ($request->filled('date_fin'))   $query->whereDate('date', '<=', $request->date_fin);
            return response()->json(['nb' => $query->count(), 'montant' => $query->sum('prix')]);
        } catch (\Exception $e) {
            return response()->json(['nb' => 0, 'montant' => 0]);
        }
    }
}