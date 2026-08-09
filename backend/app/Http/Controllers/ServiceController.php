<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ServiceController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('services')->select('id_services', 'service_name');

        return $this->paginate($query, $request, ['service_name'], 'id_services');
    }

    public function store(Request $request)
    {
        $request->validate([
            'service_name' => 'required|string|max:255|unique:services,service_name',
        ], [
            'service_name.unique' => 'Ce service existe déjà.',
        ]);

        $id = DB::table('services')->insertGetId([
            'service_name' => trim($request->service_name),
        ]);

        return $this->ok('Service créé avec succès', ['id_services' => $id], 201);
    }

    public function update(Request $request, $id)
    {
        $request->validate(['service_name' => 'required|string|max:255']);

        DB::table('services')->where('id_services', $id)->update([
            'service_name' => trim($request->service_name),
        ]);
        return $this->ok('Service mis à jour avec succès');
    }

    public function destroy($id)
    {
        $used = DB::table('prestation')->where('benefit_service', $id)->exists();
        if ($used) {
            return $this->err('Suppression impossible, ce service a déjà été utilisé', 422);
        }
        DB::table('services')->where('id_services', $id)->delete();
        return $this->ok('Service supprimé avec succès');
    }
}