<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

// Chaque réponse de l'API dit QUELLE session l'a produite : l'en-tête
// « X-Utilisateur » porte l'identifiant de l'utilisateur connecté.
//
// Pourquoi : tous les onglets d'un navigateur partagent le même cookie de
// session. Si un autre compte se connecte dans un second onglet, le premier
// continue d'afficher l'ancien utilisateur alors que ses requêtes partent
// désormais avec la nouvelle session. L'écran n'a aucun autre moyen de savoir
// à qui appartient la réponse qu'il reçoit : l'heure d'envoi de la requête ne
// prouve rien. Avec cet en-tête, il compare l'identité de la réponse à celle
// qu'il affiche et, si elles diffèrent, écarte la réponse et recharge la page.
//
// L'en-tête n'est posé que si quelqu'un est connecté, y compris sur un refus
// (403). Il ne révèle rien que l'utilisateur ne sache déjà : c'est son propre
// identifiant, déjà renvoyé par GET /api/user.
class IdentiteDeLaReponse
{
    public const EN_TETE = 'X-Utilisateur';

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Lu APRÈS le traitement : sur POST /login, c'est le compte qui vient
        // de se connecter ; sur POST /logout, c'est encore le compte qui se
        // déconnecte (la requête était la sienne), jamais un autre.
        $utilisateur = $request->user();
        if ($utilisateur !== null) {
            $response->headers->set(self::EN_TETE, (string) $utilisateur->getAuthIdentifier());
        }

        return $response;
    }
}
