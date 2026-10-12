/* ══════════════════════════════════════════════════════════════════════
   Message à afficher quand un appel à l'API échoue.

   Ordre de choix :
   1. le serveur n'a pas répondu (réseau coupé, serveur arrêté) : message fixe ;
   2. erreur de validation (422 avec « errors ») : le premier message de champ.
      Le résumé « message » de Laravel se termine par un suffixe anglais
      (« (and 3 more errors) ») : on ne l'utilise donc pas ;
   3. le message du serveur, s'il est exploitable. Les refus métier sont déjà
      rédigés en français côté serveur (« Solde insuffisant… ») ;
   4. sinon le message de repli fourni par l'écran.

   Rien de technique n'est affiché : une erreur 500 accompagnée de son détail
   (mode débogage du serveur) ou le « Server Error » générique donnent le
   message de repli.
   ══════════════════════════════════════════════════════════════════════ */

const SERVEUR_INJOIGNABLE = 'Serveur injoignable. Vérifiez votre connexion puis réessayez.'

// Messages anglais par défaut de Laravel, quand aucun texte français n'a été prévu.
const TRADUCTIONS: Record<string, string> = {
  'This action is unauthorized.': "Vous n'avez pas le droit d'effectuer cette action.",
  'Unauthenticated.': 'Votre session a expiré. Reconnectez-vous.',
  'CSRF token mismatch.': 'Votre session a expiré. Rechargez la page.',
  'Too Many Attempts.': 'Trop de tentatives. Réessayez dans un instant.',
}

// Messages génériques sans valeur pour l'utilisateur.
const SANS_INTERET = ['Server Error', 'Not Found', 'Method Not Allowed', 'Service Unavailable', '']

const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

export function messageErreur(err: unknown, repli: string): string {
  const reponse = (err as { response?: { status?: number; data?: unknown } } | null | undefined)?.response
  if (!reponse) return SERVEUR_INJOIGNABLE

  const data = reponse.data
  if (!data || typeof data !== 'object') return repli
  const corps = data as { message?: unknown; errors?: unknown; exception?: unknown }

  // Validation : premier message du premier champ en erreur.
  if (corps.errors && typeof corps.errors === 'object') {
    for (const messages of Object.values(corps.errors as Record<string, unknown>)) {
      const premier = texte(Array.isArray(messages) ? messages[0] : messages)
      if (premier) return premier
    }
  }

  // Erreur serveur livrée avec son détail technique : jamais affichée.
  if ((reponse.status ?? 0) >= 500 && corps.exception !== undefined) return repli

  const message = texte(corps.message).replace(/\s*\(and \d+ more errors?\)$/, '')
  if (SANS_INTERET.includes(message)) return repli

  return TRADUCTIONS[message] ?? message
}
