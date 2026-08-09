<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClientController extends BaseApiController
{
    public function index(Request $request)
    {
        $query = DB::table('client')->select(
            'id_client', 'client_name', 'client_contact', 'client_adresse'
        );

        return $this->paginate($query, $request,
            ['client_name', 'client_contact', 'client_adresse'],
            'id_client'
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'client_name'    => 'required|string|max:255',
            'client_contact' => 'nullable|string|max:100',
            'client_adresse' => 'nullable|string|max:255',
        ]);

        $id = DB::table('client')->insertGetId([
            'client_name'    => $request->client_name,
            'client_contact' => $request->client_contact ?? '',
            'client_adresse' => $request->client_adresse ?? '',
        ]);

        return $this->ok('Client créé avec succès', ['id_client' => $id], 201);
    }

    public function update(Request $request, $id)
    {
        DB::table('client')->where('id_client', $id)->update([
            'client_name'    => $request->client_name,
            'client_contact' => $request->client_contact ?? '',
            'client_adresse' => $request->client_adresse ?? '',
        ]);
        return $this->ok('Client mis à jour avec succès');
    }

    public function destroy($id)
    {
        // Empêche la suppression d'un client déjà lié à une prestation (comme le verify() de l'app CI)
        $used = DB::table('prestation')->where('benefit_client', $id)->exists();
        if ($used) {
            return $this->err('Suppression impossible, ce client a déjà été utilisé', 422);
        }
        DB::table('client')->where('id_client', $id)->delete();
        return $this->ok('Client supprimé avec succès');
    }
}