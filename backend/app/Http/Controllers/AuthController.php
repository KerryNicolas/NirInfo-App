<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /* ══════════════════════════════════════
     | REGISTER
     ══════════════════════════════════════ */
    public function register(Request $request)
    {
        $request->validate([
            'name'     => 'required|string|max:255',
            'email'    => 'required|string|email|unique:users',
            'password' => 'required|string|min:6|confirmed',
        ]);

        // Vérification email déjà utilisé (réponse explicite)
        if (User::where('email', $request->email)->exists()) {
            return response()->json([
                'message' => 'Cette adresse email est déjà associée à un compte.',
                'errors'  => ['email' => ['Cette adresse email est déjà utilisée.']],
            ], 422);
        }

        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user'    => $user,
            'token'   => $token,
            'message' => 'Compte créé avec succès.',
        ], 201);
    }

    /* ══════════════════════════════════════
     | LOGIN
     ══════════════════════════════════════ */
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Les identifiants sont incorrects.'],
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user'  => $user,
            'token' => $token,
        ]);
    }

    /* ══════════════════════════════════════
     | LOGOUT
     ══════════════════════════════════════ */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Déconnexion réussie']);
    }

    /* ══════════════════════════════════════
     | ME
     ══════════════════════════════════════ */
    public function me(Request $request)
    {
        return response()->json($request->user());
    }

    /* ══════════════════════════════════════
     | FORGOT PASSWORD — envoi du lien
     ══════════════════════════════════════ */
    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ], [
            'email.exists' => 'Aucun compte n\'est associé à cette adresse email.',
        ]);

        $status = Password::sendResetLink(
            $request->only('email')
        );

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json([
                'message' => 'Lien de réinitialisation envoyé par email.',
            ]);
        }

        return response()->json([
            'message' => 'Impossible d\'envoyer le lien. Réessayez dans quelques instants.',
        ], 500);
    }

    /* ══════════════════════════════════════
     | RESET PASSWORD — nouveau mot de passe
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
            return response()->json([
                'message' => 'Mot de passe réinitialisé avec succès.',
            ]);
        }

        return response()->json([
            'message' => 'Le lien de réinitialisation est invalide ou a expiré.',
        ], 422);
    }

    /* ══════════════════════════════════════
     | UPDATE PROFILE — infos + mot de passe
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

        // Vérifier l'ancien mot de passe si changement demandé
        if ($request->filled('password')) {
            if (!Hash::check($request->current_password, $user->password)) {
                return response()->json([
                    'message' => 'Le mot de passe actuel est incorrect.',
                    'errors'  => ['current_password' => ['Mot de passe incorrect.']],
                ], 422);
            }
        }

        // Mise à jour infos
        $user->fill($request->only(['name', 'email', 'phone']));

        // Mise à jour mot de passe si fourni
        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
        }

        $user->save();

        return response()->json([
            'user'    => $user->fresh(),
            'message' => 'Profil mis à jour avec succès.',
        ]);
    }
}