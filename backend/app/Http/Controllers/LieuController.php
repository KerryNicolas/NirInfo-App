<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Lieux de formation et de paiement (onglet « Lieu » de Session). Le nom du
// lieu est recopié en texte dans trois colonnes ; elles sont listées ici une
// seule fois pour le renommage et pour le contrôle avant suppression.
class LieuController extends BaseApiController
{
    private const UTILISATIONS = [
        'session'     => 'lieu',
        'inscription' => 'lieu_paiement',
        'certificat'  => 'lieu_paiement',
    ];

    public function index(Request $request)
    {
        $query = DB::table('lieu as l')
            ->leftJoin('salarie as s', 'l.matricule_s', '=', 's.matricule_s')
            ->select(
                'l.id_lieu',
                'l.nom_lieu as nom',
                DB::raw("CONCAT(IFNULL(s.nom_s,''),' ',IFNULL(s.prenom_s,'')) as editeur")
            );

        return $this->paginate($query, $request, ['l.nom_lieu'], 'l.id_lieu');
    }

    public function store(Request $request)
    {
        $this->normaliser($request);
        $request->validate(
            ['nom' => 'required|string|max:100|unique:lieu,nom_lieu'],
            $this->messages()
        );

        DB::table('lieu')->insert([
            'nom_lieu'    => $request->nom,
            'matricule_s' => auth()->user()->matricule ?? null,
        ]);

        return $this->ok('Lieu créé avec succès', [], 201);
    }

    public function update(Request $request, $id)
    {
        $lieu = DB::table('lieu')->where('id_lieu', $id)->first();
        if (!$lieu) return $this->err('Lieu non trouvé', 404);

        $this->normaliser($request);
        $request->validate(
            ['nom' => 'required|string|max:100|unique:lieu,nom_lieu,' . $lieu->id_lieu . ',id_lieu'],
            $this->messages()
        );

        // Le nom est recopié en texte ailleurs : s'il change, tout ce qui
        // portait l'ancien nom suit, dans la même transaction.
        DB::transaction(function () use ($lieu, $request) {
            if ($request->nom !== $lieu->nom_lieu) {
                foreach (self::UTILISATIONS as $table => $colonne) {
                    DB::table($table)->where($colonne, $lieu->nom_lieu)->update([$colonne => $request->nom]);
                }
            }
            DB::table('lieu')->where('id_lieu', $lieu->id_lieu)->update(['nom_lieu' => $request->nom]);
        });

        return $this->ok('Lieu mis à jour avec succès', ['nom' => $request->nom]);
    }

    public function destroy($id)
    {
        $lieu = DB::table('lieu')->where('id_lieu', $id)->first();
        if (!$lieu) return $this->err('Lieu non trouvé', 404);

        // Un lieu encore utilisé ne se supprime pas : les sessions et les
        // paiements qui le portent deviendraient impossibles à retrouver
        // dans les listes.
        $usages = [];
        foreach (['session' => 'session(s)', 'inscription' => 'paiement(s)', 'certificat' => 'certificat(s)'] as $table => $libelle) {
            $n = DB::table($table)->where(self::UTILISATIONS[$table], $lieu->nom_lieu)->count();
            if ($n > 0) $usages[] = "{$n} {$libelle}";
        }
        if ($usages) {
            return $this->err('Impossible de supprimer « ' . $lieu->nom_lieu . ' » : il est utilisé par ' . implode(', ', $usages) . '.', 422);
        }

        DB::table('lieu')->where('id_lieu', $lieu->id_lieu)->delete();

        return $this->ok('Lieu supprimé avec succès');
    }

    /** Espaces superflus retirés, majuscule à chaque mot (« ampefiloha » → « Ampefiloha »). */
    private function normaliser(Request $request): void
    {
        if (is_string($request->nom)) {
            $request->merge(['nom' => mb_convert_case(trim(preg_replace('/\s+/', ' ', $request->nom)), MB_CASE_TITLE)]);
        }
    }

    private function messages(): array
    {
        return [
            'nom.required' => 'Le nom du lieu est obligatoire.',
            'nom.max'      => 'Le nom du lieu ne doit pas dépasser 100 caractères.',
            'nom.unique'   => 'Ce lieu existe déjà.',
        ];
    }
}
