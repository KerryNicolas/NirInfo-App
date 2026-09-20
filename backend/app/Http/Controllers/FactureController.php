<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Concerns\GeneratesFactureNumero;

class FactureController extends Controller
{
    // FIX : même numérotation que l'inscription — l'ancienne version ici ne
    // repartait jamais à "-0001" au changement d'année (bug), et surtout
    // dupliquait une logique presque identique à celle d'Inscription. Les
    // deux passent maintenant par le même trait, donc par le même calcul.
    use GeneratesFactureNumero;

    private function createFacture(string $reference, string $numero, string $matricule): void
    {
        DB::table('facture')->insert([
            'ref_facture'    => $reference,
            'numero_facture' => $numero,
            'matricule_s'    => $matricule,
        ]);
    }

    // FIX : nouvel endpoint léger, lecture seule — pour l'autocomplétion des
    // champs Référence/Numéro/Matricule sur FacturePage.tsx. Recherche sur
    // numero_facture, ref_facture, matricule ou nom/prénom de l'étudiant,
    // limité à 10 résultats. N'existait pas avant — aucune modification de
    // la logique métier existante (verify/print/generate inchangés).
    public function suggestions(Request $request)
    {
        $q = trim((string) $request->input('search', ''));
        if (mb_strlen($q) < 1) {
            return response()->json(['data' => []]);
        }

        $results = DB::table('facture as fac')
            ->join('inscription as ins', 'fac.ref_facture', '=', 'ins.ref_facture')
            ->join('etudiant as etu',    'etu.matricule_etudiant', '=', 'ins.matricule_etudiant')
            ->where(function ($sub) use ($q) {
                $sub->where('fac.numero_facture', 'like', "%{$q}%")
                    ->orWhere('fac.ref_facture', 'like', "%{$q}%")
                    ->orWhere('ins.matricule_etudiant', 'like', "%{$q}%")
                    ->orWhere('etu.nom_etudiant', 'like', "%{$q}%")
                    ->orWhere('etu.prenom_etudiant', 'like', "%{$q}%");
            })
            ->select(
                'fac.ref_facture',
                'fac.numero_facture',
                'ins.matricule_etudiant as matricule',
                'ins.code_session',
                'etu.nom_etudiant  as nom',
                'etu.prenom_etudiant as prenom'
            )
            ->distinct()
            ->orderBy('fac.ref_facture', 'desc')
            ->limit(10)
            ->get();

        return response()->json(['data' => $results]);
    }

    // ─── Lecture complète d'une facture par référence — colonnes explicites ──
    private function getByReference(string $reference): ?object
    {
        if ($reference === '' || $reference === '0') return null;

        $res = DB::table('facture as fac')
            ->join('inscription as ins',      'ins.ref_facture',        '=', 'fac.ref_facture')
            ->join('session',                 'ins.code_session',       '=', 'session.code_session')
            ->join('module',                  'session.code_module',    '=', 'module.code_module')
            ->join('etudiant as etu',         'etu.matricule_etudiant', '=', 'ins.matricule_etudiant')
            ->leftJoin('horaire as h',        'session.code_horaire',   '=', 'h.code_horaire')
            ->where('fac.ref_facture', $reference)
            ->select(
                'fac.ref_facture',
                'fac.numero_facture',
                'ins.id_paiement',
                'module.nom_module',
                'session.debut_session',
                'session.fin_session',
                'session.frais_module',
                'ins.montant_paye',
                'ins.date_paiement as date_facture',
                'ins.code_session',
                'ins.matricule_etudiant',
                'etu.nom_etudiant',
                'etu.prenom_etudiant',
                'etu.tel_etudiant',
                'etu.mail_etudiant',
                'h.description_horaire as horaire_desc'
            )
            // Si plusieurs lignes matchent encore ref_facture (doublons résiduels),
            // on force la plus récente au lieu de laisser SQL choisir au hasard
            ->orderBy('ins.id_paiement', 'DESC')
            ->limit(1)
            ->first();

        if (!$res) return null;

        $sommeDeja = DB::table('inscription')
            ->where('matricule_etudiant', $res->matricule_etudiant)
            ->where('code_session',       $res->code_session)
            ->where('id_paiement', '<', $res->id_paiement)
            ->sum('montant_paye');

        $res->somme_deja_paye = (int) $sommeDeja;
        $res->total_paye      = (int) $sommeDeja + (int) $res->montant_paye;
        $res->reste_a_payer   = (int) $res->frais_module - (int) $res->total_paye;

        return $res;
    }

    // ─── Filtre multi-critères — colonnes explicites + exclusion ref_facture invalides ──
    private function getFactureFiltered(
        string $reference,
        string $numero,
        string $matricule,
        string $session,
        string $date
    ) {
        $q = DB::table('facture as fac')
            ->join('inscription as ins', 'fac.ref_facture', '=', 'ins.ref_facture')
            ->where('fac.ref_facture', '!=', '0')
            ->whereNotNull('fac.ref_facture');

        if ($reference !== '') $q->where('fac.ref_facture',        $reference);
        if ($numero    !== '') $q->where('fac.numero_facture',     $numero);
        if ($matricule !== '') $q->where('ins.matricule_etudiant', $matricule);
        if ($session   !== '') $q->where('ins.code_session',       $session);
        if ($date      !== '') $q->where('ins.date_paiement', 'LIKE', $date . '%');

        return $q->select(
                'fac.ref_facture',
                'fac.numero_facture',
                'ins.id_paiement',
                'ins.matricule_etudiant',
                'ins.code_session',
                'ins.date_paiement'
            )
            ->distinct()
            ->orderBy('ins.id_paiement', 'DESC')
            ->get();
    }

    private function formatFacture(object $f): array
    {
        return [
            'reference'    => $f->ref_facture,
            'numero'       => $f->numero_facture,
            'date_facture' => $f->date_facture,
            'etudiant'     => [
                'matricule' => $f->matricule_etudiant,
                'nom'       => $f->nom_etudiant,
                'prenom'    => $f->prenom_etudiant,
                'telephone' => $f->tel_etudiant,
                'email'     => $f->mail_etudiant,
            ],
            'session'      => [
                'code_session'    => $f->code_session,
                'module_nom'      => $f->nom_module,
                'date_debut'      => $f->debut_session,
                'date_fin'        => $f->fin_session,
                'frais_formation' => $f->frais_module,
                'lieu'            => '—',
                'horaire_desc'    => $f->horaire_desc ?? '—',
            ],
            'inscription'  => [
                'montant_paye'    => $f->montant_paye,
                'somme_deja_paye' => $f->somme_deja_paye,
                'total_paye'      => $f->total_paye,
                'reste'           => $f->reste_a_payer,
                'date_paiement'   => $f->date_facture,
                'compte'          => null,
            ],
            'centre' => [
                'nom'     => "Nir'Info",
                'adresse' => 'LOT IIA 80 C Ampandrana Ouest, Antananarivo 101',
                'tel'     => 'Tél: 034 36 176 60 – 034 77 775 34',
                'email'   => 'admin@nir-info.mg',
            ],
        ];
    }

    public function verify(Request $request)
    {
        $filled = collect($request->only(['reference', 'numero', 'matricule', 'code_session', 'date_paiement']))
            ->filter(fn($v) => $v !== '' && $v !== null);

        if ($filled->isEmpty()) {
            return response()->json(['error' => 'Certains champs sont obligatoires'], 422);
        }

        $reference = (string) ($request->input('reference',     '') ?? '');
        $numero    = (string) ($request->input('numero',        '') ?? '');
        $matricule = (string) ($request->input('matricule',     '') ?? '');
        $session   = (string) ($request->input('code_session',  '') ?? '');
        $date      = (string) ($request->input('date_paiement', '') ?? '');

        $results = $this->getFactureFiltered($reference, $numero, $matricule, $session, $date);

        if ($results->isEmpty()) {
            return response()->json(['error' => 'Aucune facture trouvée'], 404);
        }

        return response()->json([
            'success'    => true,
            'references' => $results->pluck('ref_facture')->unique()->values(),
        ]);
    }

    public function printAll(Request $request)
    {
        $request->validate(['references' => 'required|array']);

        $factures = [];
        foreach (array_unique($request->references) as $ref) {
            $f = $this->getByReference($ref);
            if ($f) {
                $factures[] = $this->formatFacture($f);
            }
        }

        return response()->json($factures);
    }

    public function print(string $reference)
    {
        $facture = $this->getByReference($reference);
        if (!$facture) {
            return response()->json(['message' => 'Facture non trouvée'], 404);
        }
        return response()->json($this->formatFacture($facture));
    }

    public function generate(Request $request)
    {
        $request->validate([
            'matricule'     => 'required|string',
            'code_session'  => 'required|string',
            'date_paiement' => 'nullable|date',
        ]);

        $etudiant = DB::table('etudiant')->where('matricule_etudiant', $request->matricule)->first();
        if (!$etudiant) return response()->json(['message' => 'Étudiant non trouvé'], 404);

        $session = DB::table('session as s')
            ->join('module as m', 's.code_module', '=', 'm.code_module')
            ->leftJoin('horaire as h', 's.code_horaire', '=', 'h.code_horaire')
            ->where('s.code_session', $request->code_session)
            ->select('s.*', 'm.nom_module as module_nom', 'h.description_horaire as horaire_desc')
            ->first();
        if (!$session) return response()->json(['message' => 'Session non trouvée'], 404);

        $inscriptionQuery = DB::table('inscription')
            ->where('matricule_etudiant', $request->matricule)
            ->where('code_session', $request->code_session);
        if ($request->filled('date_paiement')) {
            $inscriptionQuery->whereDate('date_paiement', $request->date_paiement);
        }
        $inscription = $inscriptionQuery->orderBy('id_paiement', 'DESC')->first();
        if (!$inscription) return response()->json(['message' => 'Inscription / paiement non trouvé'], 404);

        // ── Réutilise la facture existante si elle existe déjà pour ce paiement ──
        $facExistante = DB::table('facture')->where('ref_facture', $inscription->ref_facture)->first();

        if ($facExistante) {
            $reference = $facExistante->ref_facture;
            $numero    = $facExistante->numero_facture;
        } else {
            $numero    = $this->generateNumeroFacture();
            $reference = $inscription->ref_facture; // ← on lie la facture à la référence déjà générée par l'inscription
            $this->createFacture($reference, $numero, auth()->user()->matricule ?? 'SYSTEM');
        }

        $sommeDeja = DB::table('inscription')
            ->where('matricule_etudiant', $request->matricule)
            ->where('code_session', $request->code_session)
            ->where('id_paiement', '<', $inscription->id_paiement)
            ->sum('montant_paye');

        $totalPaye   = (int) $sommeDeja + (int) $inscription->montant_paye;
        $resteAPayer = (int) $session->frais_module - $totalPaye;

        return response()->json([
            'reference'    => $reference,
            'numero'       => $numero,
            'date_facture' => now()->format('d/m/Y'),
            'etudiant'     => [
                'matricule' => $etudiant->matricule_etudiant,
                'nom'       => $etudiant->nom_etudiant,
                'prenom'    => $etudiant->prenom_etudiant,
                'telephone' => $etudiant->tel_etudiant,
                'email'     => $etudiant->mail_etudiant,
            ],
            'session'      => [
                'code_session'    => $session->code_session,
                'module_nom'      => $session->module_nom,
                'date_debut'      => $session->debut_session,
                'date_fin'        => $session->fin_session,
                'frais_formation' => $session->frais_module,
                'lieu'            => '—',
                'horaire_desc'    => $session->horaire_desc ?? '—',
            ],
            'inscription'  => [
                'montant_paye'    => $inscription->montant_paye,
                'somme_deja_paye' => (int) $sommeDeja,
                'total_paye'      => $totalPaye,
                'reste'           => $resteAPayer,
                'date_paiement'   => $inscription->date_paiement,
                'compte'          => $inscription->type_paiement ?? null,
            ],
            'centre' => [
                'nom'     => "Nir'Info",
                'adresse' => 'LOT IIA 80 C Ampandrana Ouest, Antananarivo 101',
                'tel'     => 'Tél: 034 36 176 60 – 034 77 775 34',
                'email'   => 'admin@nir-info.mg',
            ],
        ]);
    }

    public function destroy(string $reference)
    {
        $deleted = DB::table('facture')->where('ref_facture', $reference)->delete();
        if (!$deleted) return response()->json(['message' => 'Facture introuvable'], 404);
        return response()->json(['message' => 'Facture supprimée']);
    }
}