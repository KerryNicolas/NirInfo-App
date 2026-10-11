<?php
namespace App\Http\Controllers;

use App\Services\DepenseService;
use App\Services\IndicateursTresorerieService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

// Indicateurs de trésorerie : Trésorerie, À valider, Engagé, Décaissé,
// Disponible réel. LECTURE SEULE — voir App\Services\IndicateursTresorerieService.
class TresorerieController extends BaseApiController
{
    // GET /tresorerie/indicateurs?du=AAAA-MM-JJ&au=AAAA-MM-JJ
    //
    // La période ne concerne que le Décaissé : le mois en cours par défaut.
    //
    // Suivi de trésorerie désactivé (config/depenses.php) : seule la
    // trésorerie est renvoyée. Les autres indicateurs reposent sur les
    // colonnes du suivi, qui n'existent pas sur une base non migrée : elles
    // ne sont alors pas lues du tout.
    public function indicateurs(Request $request, IndicateursTresorerieService $service)
    {
        $request->validate([
            'du' => 'nullable|date_format:Y-m-d',
            'au' => 'nullable|date_format:Y-m-d',
        ], [
            'du.date_format' => 'La date de début doit être au format AAAA-MM-JJ.',
            'au.date_format' => 'La date de fin doit être au format AAAA-MM-JJ.',
        ]);

        return $this->proteger('Erreur lors du calcul des indicateurs', function () use ($request, $service) {
            if (!DepenseService::actif()) {
                return response()->json(['suivi_actif' => false, 'tresorerie' => $service->tresorerie()]);
            }

            $du = $request->filled('du') ? Carbon::createFromFormat('Y-m-d', $request->du) : now()->startOfMonth();
            $au = $request->filled('au') ? Carbon::createFromFormat('Y-m-d', $request->au) : now()->endOfMonth();

            if ($au->copy()->startOfDay()->lt($du->copy()->startOfDay())) {
                return $this->err('La date de fin ne peut pas précéder la date de début.', 422);
            }

            return response()->json(['suivi_actif' => true] + $service->indicateurs($du, $au));
        });
    }
}
