<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /* ══════════════════════════════════════
     | LOGIN — authentification par session + cookie httpOnly
     ══════════════════════════════════════ */
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($request->only('email', 'password'), $request->boolean('remember'))) {
            Log::warning('Échec de connexion', [
                'email' => $request->email,
                'ip'    => $request->ip(),
            ]);

            throw ValidationException::withMessages([
                'email' => ['Les identifiants sont incorrects.'],
            ]);
        }

        $request->session()->regenerate();

        $user = Auth::user();
        $user->load('roleRelation.permissions');

        Log::info('Connexion réussie', ['user_id' => $user->id, 'ip' => $request->ip()]);

        return response()->json([
            'user' => $this->formatUser($user),
        ]);
    }

    /* ══════════════════════════════════════
     | LOGOUT
     ══════════════════════════════════════ */
    public function logout(Request $request)
    {
        $userId = $request->user()?->id;

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        Log::info('Déconnexion', ['user_id' => $userId, 'ip' => $request->ip()]);

        return response()->json(['message' => 'Déconnexion réussie']);
    }

    /* ══════════════════════════════════════
     | ME — restaure la session au chargement de l'app
     ══════════════════════════════════════ */
    public function me(Request $request)
    {
        $user = $request->user();
        $user->load('roleRelation.permissions');

        return response()->json($this->formatUser($user));
    }

    /* ══════════════════════════════════════
     | CREATE USER — remplace l'ancien /register public. Réservé admin.
     ══════════════════════════════════════ */
    public function createUser(Request $request)
    {
        if ($request->user()->roleRelation?->slug !== 'admin') {
            return response()->json([
                'message' => "Seul un administrateur peut créer un compte.",
            ], 403);
        }

        $request->validate([
            'nom'      => 'required|string|max:255',
            'prenom'   => 'required|string|max:255',
            'email'    => 'required|string|email|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'role_id'  => 'required|integer|exists:roles,id',
        ]);

        DB::beginTransaction();
        try {
            // FIX : génère automatiquement un matricule salarié et crée la
            // ligne `salarie` correspondante — sans ça, le champ "Éditeur"
            // affiché partout dans l'appli (Module, Session, Achat, etc.)
            // reste vide pour ce compte, faute de ligne à joindre via
            // matricule_s. S'applique à tout nouveau compte, quel que soit
            // son rôle (admin ou gestionnaire) — le bug touchait tous les
            // comptes de la même façon, pas seulement Admin.
            $year = date('Y');
            $last = DB::table('salarie')
                ->where('matricule_s', 'like', "S-{$year}-%")
                ->orderByDesc('matricule_s')
                ->value('matricule_s');
            $seq = 1;
            if ($last) {
                $parts = explode('-', $last);
                $seq = ((int) end($parts)) + 1;
            }
            $matriculeS = "S-{$year}-" . str_pad($seq, 3, '0', STR_PAD_LEFT);

            DB::table('salarie')->insert([
                'matricule_s' => $matriculeS,
                'nom_s'       => strtoupper($request->nom),
                'prenom_s'    => $request->prenom,
            ]);

            $user = User::create([
                'name'      => $request->nom . ' ' . $request->prenom,
                'email'     => $request->email,
                'password'  => Hash::make($request->password),
                'role_id'   => $request->role_id,
                'matricule' => $matriculeS,
            ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Erreur lors de la création du compte', 'error' => $e->getMessage()], 500);
        }

        $user->load('roleRelation.permissions');

        Log::info('Compte créé', [
            'created_user_id' => $user->id,
            'created_by'      => $request->user()->id,
        ]);

        return response()->json([
            'user'    => $this->formatUser($user),
            'message' => 'Compte créé avec succès.',
        ], 201);
    }

    /* ══════════════════════════════════════
     | FORGOT PASSWORD
     ══════════════════════════════════════ */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ], [
            'email.exists' => 'Aucun compte n\'est associé à cette adresse email.',
        ]);

        $status = Password::sendResetLink($request->only('email'));

        Log::info('Demande de réinitialisation de mot de passe', [
            'email' => $request->email,
            'ip'    => $request->ip(),
        ]);

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json(['message' => 'Lien de réinitialisation envoyé par email.']);
        }

        return response()->json([
            'message' => 'Impossible d\'envoyer le lien. Réessayez dans quelques instants.',
        ], 500);
    }

    /* ══════════════════════════════════════
     | RESET PASSWORD
     ══════════════════════════════════════ */
    public function resetPassword(Request $request)
    {
        $request->validate([
            'token'                 => 'required',
            'email'                 => 'required|email',
            'password'              => 'required|string|min:8|confirmed',
            'password_confirmation' => 'required',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password'       => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Mot de passe réinitialisé avec succès.']);
        }

        return response()->json([
            'message' => 'Le lien de réinitialisation est invalide ou a expiré.',
        ], 422);
    }

    /* ══════════════════════════════════════
     | UPDATE PROFILE
     ══════════════════════════════════════ */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'name'                  => 'sometimes|string|max:255',
            'email'                 => 'sometimes|email|unique:users,email,' . $user->id,
            'phone'                 => 'sometimes|nullable|string|max:20',
            'current_password'      => 'required_with:password',
            'password'              => 'sometimes|string|min:8|confirmed',
            'password_confirmation' => 'required_with:password',
        ]);

        if ($request->filled('password')) {
            if (!Hash::check($request->current_password, $user->password)) {
                return response()->json([
                    'message' => 'Le mot de passe actuel est incorrect.',
                    'errors'  => ['current_password' => ['Mot de passe incorrect.']],
                ], 422);
            }
        }

        $user->fill($request->only(['name', 'email', 'phone']));

        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
            Log::info('Mot de passe modifié', ['user_id' => $user->id]);
        }

        $user->save();
        $user->load('roleRelation.permissions');

        return response()->json([
            'user'    => $this->formatUser($user->fresh()->load('roleRelation.permissions')),
            'message' => 'Profil mis à jour avec succès.',
        ]);
    }

    /* ══════════════════════════════════════
     | HELPER
     ══════════════════════════════════════ */
    private function formatUser(User $user): array
    {
        $data = $user->toArray();
        unset($data['role_relation']);

        $data['role_slug']   = $user->roleRelation?->slug;
        $data['permissions'] = $user->roleRelation?->permissions->pluck('slug') ?? [];

        return $data;
    }
}