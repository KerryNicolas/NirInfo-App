<?php

namespace App\Http\Controllers;

use App\Mail\AccountActivationMail;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Clé de session utilisée par le middleware AuthenticateSession de Sanctum
     * pour mémoriser l'empreinte du mot de passe de l'utilisateur connecté.
     * Format imposé par Sanctum : "password_hash_" + nom du guard (ici "web",
     * cf. config/sanctum.php -> 'guard' => ['web']).
     */
    private const PASSWORD_HASH_KEY = 'password_hash_web';

    /**
     * Verrouillage après échecs de connexion : 5 échecs pour un même couple
     * email + adresse IP => blocage de 15 minutes (compté à partir du premier
     * échec). Le compteur est remis à zéro à la première connexion réussie.
     * Stocké dans le cache Laravel (CACHE_DRIVER), aucune migration requise.
     */
    private const MAX_LOGIN_ATTEMPTS    = 5;
    private const LOGIN_LOCKOUT_SECONDS = 15 * 60;

    /**
     * Message unique pour tout échec d'activation (lien faux, expiré, déjà
     * utilisé, compte déjà actif) : on ne révèle pas lequel.
     */
    private const ACTIVATION_FAILED_MESSAGE =
        "Le lien d'activation est invalide, expiré ou déjà utilisé. Demandez à un administrateur de vous en renvoyer un.";

    /* ══════════════════════════════════════
     | LOGIN — authentification par session + cookie httpOnly
     ══════════════════════════════════════ */
    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|email',
            'password' => 'required',
        ], [
            // Messages en français (sinon Laravel répond en anglais par défaut)
            'email.required'    => "L'adresse email est obligatoire.",
            'email.email'       => "L'adresse email n'est pas valide.",
            'password.required' => 'Le mot de passe est obligatoire.',
        ]);

        // VERROUILLAGE : si ce couple email + IP a déjà échoué 5 fois, on
        // refuse sans même vérifier le mot de passe, jusqu'à la fin du blocage.
        $throttleKey = $this->loginThrottleKey($request);

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_LOGIN_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            $minutes = max(1, (int) ceil($seconds / 60));

            Log::warning('Connexion bloquée (trop de tentatives)', [
                'email'       => $request->email,
                'ip'          => $request->ip(),
                'retry_after' => $seconds,
            ]);

            return response()->json([
                'message'     => "Trop de tentatives de connexion. Réessayez dans {$minutes} minute" . ($minutes > 1 ? 's' : '') . '.',
                'retry_after' => $seconds,
            ], 429);
        }

        // FIX DOUBLE CONNEXION : on repart TOUJOURS d'une session vierge avant
        // d'authentifier (équivalent du sess_destroy() de l'ancien CodeIgniter).
        //
        // Cause du bug : après la déconnexion du compte A, le middleware
        // AuthenticateSession de Sanctum réécrit l'empreinte du mot de passe
        // de A dans la session. Quand B se connectait ensuite, cette empreinte
        // restait en session ; à la première requête protégée, Sanctum
        // comparait l'empreinte de A au mot de passe de B, constatait la
        // différence et déconnectait B (401) — d'où la deuxième connexion.
        if (Auth::guard('web')->check()) {
            Auth::guard('web')->logout();
        }
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if (!Auth::attempt($request->only('email', 'password'), $request->boolean('remember'))) {
            // VERROUILLAGE : un échec de plus pour ce couple email + IP.
            RateLimiter::hit($throttleKey, self::LOGIN_LOCKOUT_SECONDS);

            Log::warning('Échec de connexion', [
                'email'    => $request->email,
                'ip'       => $request->ip(),
                'attempts' => RateLimiter::attempts($throttleKey),
            ]);

            throw ValidationException::withMessages([
                'email' => ['Les identifiants sont incorrects.'],
            ]);
        }

        // VERROUILLAGE : connexion réussie => compteur d'échecs remis à zéro.
        RateLimiter::clear($throttleKey);

        // COMPTE EN ATTENTE : un compte créé par l'admin mais pas encore activé
        // (activated_at vide) ne peut pas se connecter. En pratique son mot de
        // passe est aléatoire et inconnu ; ce contrôle est une seconde barrière.
        if (!Auth::user()->isActivated()) {
            $pendingId = Auth::id();

            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            Log::warning('Connexion refusée : compte non activé', [
                'user_id' => $pendingId,
                'ip'      => $request->ip(),
            ]);

            return response()->json([
                'message' => "Ce compte n'est pas encore activé. Utilisez le lien d'activation reçu par email.",
            ], 403);
        }

        $request->session()->regenerate();

        $user = Auth::user();

        // FIX DOUBLE CONNEXION (suite) : on inscrit nous-mêmes l'empreinte du
        // NOUVEL utilisateur, pour que la session soit cohérente dès la
        // première requête protégée.
        $request->session()->put(self::PASSWORD_HASH_KEY, $user->getAuthPassword());

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

        // NOTE : Sanctum peut réécrire l'empreinte de cet utilisateur dans la
        // session juste après cette méthode. Ce n'est plus un problème :
        // login() repart désormais d'une session vierge.

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
            'email'    => 'required|string|email|max:255|unique:users',
            'role_id'  => 'required|integer|exists:roles,id',
        ], [
            'nom.required'     => 'Le nom est obligatoire.',
            'prenom.required'  => 'Le prénom est obligatoire.',
            'email.required'   => "L'adresse email est obligatoire.",
            'email.email'      => "L'adresse email n'est pas valide.",
            'email.unique'     => 'Cette adresse email est déjà utilisée.',
            'role_id.required' => 'Le rôle est obligatoire.',
            'role_id.exists'   => "Le rôle choisi n'existe pas.",
        ]);

        // NOUVEAU FLUX : l'admin ne choisit plus de mot de passe. Le compte est
        // créé avec un mot de passe aléatoire que personne ne connaît, puis un
        // lien d'activation à usage unique (valable 48 h) est envoyé par email.
        // C'est l'utilisateur qui définit lui-même son mot de passe.
        // Si l'envoi de l'email échoue, TOUT est annulé (rollback) : pas de
        // compte fantôme inaccessible.
        $step = 'creation';

        DB::beginTransaction();
        try {
            // FIX : génère automatiquement un matricule salarié et crée la
            // ligne `salarie` correspondante — sans ça, le champ "Éditeur"
            // affiché partout dans l'appli (Module, Session, Achat, etc.)
            // reste vide pour ce compte, faute de ligne à joindre via
            // matricule_s. S'applique à tout nouveau compte, quel que soit
            // son rôle (admin ou gestionnaire) — le bug touchait tous les
            // comptes de la même façon, pas seulement Admin.
            //
            // FIX DOUBLON MATRICULE : le prochain numéro est calculé à partir
            // des DEUX tables (salarie ET users), et comparé comme un nombre.
            // Avant, seule la table salarie était lue : si un compte existait
            // dans users sans sa ligne salarie (ex. ligne supprimée à la main),
            // le même matricule était proposé à nouveau et la création
            // échouait (erreur 1062 sur users_matricule_unique).
            $year   = date('Y');
            $prefix = "S-{$year}-";

            $existing = DB::table('salarie')
                ->where('matricule_s', 'like', $prefix . '%')
                ->pluck('matricule_s')
                ->merge(
                    DB::table('users')
                        ->where('matricule', 'like', $prefix . '%')
                        ->pluck('matricule')
                );

            $lastSeq = $existing
                ->map(fn ($m) => (int) substr((string) $m, strlen($prefix)))
                ->max() ?? 0;

            $matriculeS = $prefix . str_pad((string) ($lastSeq + 1), 3, '0', STR_PAD_LEFT);

            DB::table('salarie')->insert([
                'matricule_s' => $matriculeS,
                'nom_s'       => strtoupper($request->nom),
                'prenom_s'    => $request->prenom,
            ]);

            $user = User::create([
                'name'      => $request->nom . ' ' . $request->prenom,
                'email'     => $request->email,
                // Mot de passe aléatoire inutilisable : remplacé à l'activation.
                'password'  => Hash::make(Str::random(64)),
                'role_id'   => $request->role_id,
                'matricule' => $matriculeS,
            ]);

            // Jeton d'activation à usage unique — broker "invitations" (table
            // dédiée account_activation_tokens, 48 h), déclaré dans
            // AppServiceProvider. Laravel ne stocke que son hash.
            $token = Password::broker('invitations')->createToken($user);

            $activationUrl = rtrim(config('app.frontend_url', 'http://localhost:5173'), '/')
                . '/reset-password'
                . '?token=' . $token
                . '&email=' . urlencode($user->email)
                . '&activation=1';

            // Envoi synchrone : une exception ici déclenche le rollback.
            $step = 'email';
            Mail::to($user->email)->send(
                new AccountActivationMail($user, $activationUrl, User::ACTIVATION_LINK_HOURS)
            );

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();

            Log::error('Création de compte annulée', [
                'step'       => $step,
                'email'      => $request->email,
                'created_by' => $request->user()->id,
                'error'      => $e->getMessage(),
            ]);

            if ($step === 'email') {
                return response()->json([
                    'message' => "L'email d'activation n'a pas pu être envoyé. Le compte n'a pas été créé. Vérifiez l'adresse puis réessayez.",
                ], 502);
            }

            return response()->json([
                'message' => 'Erreur lors de la création du compte.',
            ], 500);
        }

        $user->load('roleRelation.permissions');

        Log::info('Compte créé', [
            'created_user_id' => $user->id,
            'created_by'      => $request->user()->id,
        ]);

        return response()->json([
            'user'    => $this->formatUser($user),
            'message' => "Compte créé avec succès. Un lien d'activation a été envoyé à l'adresse email indiquée.",
        ], 201);
    }

    /* ══════════════════════════════════════
     | ACTIVATE ACCOUNT — route publique. L'utilisateur arrive depuis le lien
     | reçu par email et définit son mot de passe. Le jeton est supprimé par
     | Laravel dès qu'il a servi (usage unique) et expire au bout de 48 h.
     ══════════════════════════════════════ */
    public function activateAccount(Request $request)
    {
        $request->validate([
            'token'    => 'required|string',
            'email'    => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ], [
            'token.required'     => "Le lien d'activation est incomplet.",
            'email.required'     => "Le lien d'activation est incomplet.",
            'email.email'        => "Le lien d'activation est invalide.",
            'password.required'  => 'Le mot de passe est obligatoire.',
            'password.min'       => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.confirmed' => 'Les mots de passe ne correspondent pas.',
        ]);

        // Un compte déjà activé ne peut plus jamais être "activé" : on refuse
        // et on supprime tout jeton qui traînerait encore pour cet email.
        $existing = User::where('email', $request->email)->first();

        if ($existing && $existing->isActivated()) {
            DB::table('account_activation_tokens')->where('email', $existing->email)->delete();

            Log::warning("Tentative d'activation d'un compte déjà actif", [
                'user_id' => $existing->id,
                'ip'      => $request->ip(),
            ]);

            return response()->json(['message' => self::ACTIVATION_FAILED_MESSAGE], 422);
        }

        // Broker "invitations" : table account_activation_tokens, 48 h.
        // Laravel vérifie le jeton + son âge, puis le SUPPRIME (usage unique).
        $status = Password::broker('invitations')->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password'          => Hash::make($password),
                    'remember_token'    => Str::random(60),
                    'activated_at'      => now(),
                    // Le clic sur le lien prouve que l'adresse email est valide.
                    'email_verified_at' => $user->email_verified_at ?? now(),
                ])->save();

                Log::info('Compte activé', ['user_id' => $user->id]);
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Compte activé. Vous pouvez maintenant vous connecter.',
            ]);
        }

        return response()->json(['message' => self::ACTIVATION_FAILED_MESSAGE], 422);
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

        // Un compte en attente n'a pas droit à la réinitialisation classique :
        // il doit passer par son lien d'activation.
        $account = User::where('email', $request->email)->first();
        if ($account && !$account->isActivated()) {
            return response()->json([
                'message' => "Ce compte n'est pas encore activé. Utilisez le lien d'activation reçu par email ou contactez un administrateur.",
            ], 422);
        }

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

        // Étanchéité : la réinitialisation classique est fermée aux comptes en
        // attente (ils ne passent que par /activate-account).
        $account = User::where('email', $request->email)->first();
        if ($account && !$account->isActivated()) {
            return response()->json([
                'message' => 'Le lien de réinitialisation est invalide ou a expiré.',
            ], 422);
        }

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

        $passwordChanged = false;
        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
            $passwordChanged = true;
            Log::info('Mot de passe modifié', ['user_id' => $user->id]);
        }

        $user->save();

        // FIX : après un changement de mot de passe, on met à jour l'empreinte
        // en session. Sans ça, Sanctum (AuthenticateSession) voit une empreinte
        // périmée à la requête suivante et déconnecte l'utilisateur — même
        // mécanisme que le bug de double connexion.
        if ($passwordChanged && $request->hasSession()) {
            $request->session()->put(self::PASSWORD_HASH_KEY, $user->getAuthPassword());
        }

        $user->load('roleRelation.permissions');

        return response()->json([
            'user'    => $this->formatUser($user->fresh()->load('roleRelation.permissions')),
            'message' => 'Profil mis à jour avec succès.',
        ]);
    }

    /* ══════════════════════════════════════
     | HELPER
     ══════════════════════════════════════ */

    /**
     * Clé du compteur d'échecs de connexion : email (en minuscules) + IP.
     * Email + IP plutôt qu'email seul : sinon n'importe qui pourrait bloquer
     * volontairement le compte admin en se trompant 5 fois.
     */
    private function loginThrottleKey(Request $request): string
    {
        return 'login:' . Str::lower((string) $request->input('email')) . '|' . $request->ip();
    }

    private function formatUser(User $user): array
    {
        $data = $user->toArray();
        unset($data['role_relation']);

        $data['role_slug']   = $user->roleRelation?->slug;
        $data['permissions'] = $user->roleRelation?->permissions->pluck('slug') ?? [];

        return $data;
    }
}