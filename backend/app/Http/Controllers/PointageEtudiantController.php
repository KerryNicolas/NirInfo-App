<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Pointage des étudiants — table `pointage_etudiant` (une ligne par étudiant,
// par session et par jour). Appelé par PointageTab.tsx, qui n'avait jusqu'ici
// aucune route en face : l'écran annonçait « Pointage sauvegardé » sans que
// rien ne soit enregistré.
class PointageEtudiantController extends BaseApiController
{
    // ─── Étudiants inscrits à une session — GET /pointage-etudiant/inscrits ──
    // Tous les inscrits, une seule fois chacun (un étudiant a une ligne
    // `inscription` par paiement), sans pagination : la feuille de pointage
    // doit être complète quel que soit l'effectif.
    public function inscrits(Request $request)
    {
        $request->validate(['session' => 'required|string']);

        $rows = DB::table('inscription as i')
            ->join('etudiant as e', 'i.matricule_etudiant', '=', 'e.matricule_etudiant')
            ->where('i.code_session', $request->session)
            ->select(
                'e.matricule_etudiant as matricule',
                'e.nom_etudiant       as nom',
                'e.prenom_etudiant    as prenom'
            )
            ->distinct()
            ->orderBy('e.nom_etudiant')
            ->orderBy('e.prenom_etudiant')
            ->get();

        return response()->json(['data' => $rows]);
    }

    // ─── Présences d'une session à une date donnée — GET /pointage-etudiant ──
    public function index(Request $request)
    {
        $request->validate([
            'session' => 'required|string',
            'date'    => 'required|date',
        ]);

        $rows = DB::table('pointage_etudiant')
            ->where('session', $request->session)
            ->whereDate('date', $request->date)
            ->select('id_pointage_etudiant', 'date', 'matricule_etudiant', 'session', 'present', 'justificatif')
            ->get();

        return response()->json(['data' => $rows]);
    }

    // ─── Enregistre la présence d'un étudiant — POST /pointage-etudiant ──
    // Une seule ligne par (date, étudiant, session) : sauvegarder deux fois le
    // même jour met à jour la présence au lieu de créer un doublon. La table
    // n'a pas d'index unique sur ce triplet, d'où la recherche explicite.
    public function store(Request $request)
    {
        $request->validate([
            'date'               => 'required|date',
            'matricule_etudiant' => 'required|string|exists:etudiant,matricule_etudiant',
            'session'            => 'required|string|exists:session,code_session',
            'present'            => 'required|boolean',
        ]);

        $cle = [
            'date'               => $request->date,
            'matricule_etudiant' => $request->matricule_etudiant,
            'session'            => $request->session,
        ];
        $present = $request->boolean('present') ? 1 : 0;

        $existant = DB::table('pointage_etudiant')->where($cle)->first();

        if ($existant) {
            DB::table('pointage_etudiant')
                ->where('id_pointage_etudiant', $existant->id_pointage_etudiant)
                ->update(['present' => $present]);

            return $this->ok('Pointage mis à jour', ['id_pointage_etudiant' => $existant->id_pointage_etudiant]);
        }

        $id = DB::table('pointage_etudiant')->insertGetId($cle + ['present' => $present], 'id_pointage_etudiant');

        return $this->ok('Pointage enregistré', ['id_pointage_etudiant' => $id], 201);
    }
}
