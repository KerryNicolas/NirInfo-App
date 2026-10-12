import { useEffect, useRef, useSyncExternalStore } from 'react'
import api from '../api/axios'
import { useAuth } from '../contexts/AuthContext'

/* ══════════════════════════════════════════════════════════════════════
   Sentinelle de session — un seul exemplaire, monté dans App.tsx.

   Tous les onglets partagent la session du navigateur, mais chacun garde sa
   propre idée de qui est connecté. Si un autre compte se connecte (ou si l'on
   se déconnecte) dans un second onglet, celui-ci continuerait d'afficher les
   écrans du premier utilisateur avec la session du second.

   Dès que la sentinelle constate que la session du navigateur n'est plus
   celle que cet onglet affiche, elle RECHARGE LA PAGE : tout ce que l'onglet
   gardait en mémoire disparaît (listes en cache comprises) et l'application
   redémarre avec la bonne identité. Elle ne modifie jamais l'état de
   connexion elle-même : AuthContext n'est pas touché.

   Trois protections, de la plus sûre à la plus rapide :

   1. CHAQUE RÉPONSE EST VÉRIFIÉE. Le serveur indique dans l'en-tête
      « X-Utilisateur » quelle session a produit la réponse (middleware
      IdentiteDeLaReponse). Si ce n'est pas le compte affiché, la réponse
      n'est remise à AUCUN écran — elle ne peut donc être ni affichée ni
      rangée dans un cache — et la page est rechargée. C'est la seule garantie
      réelle : le moment où une requête est partie ne prouve pas à qui
      appartient sa réponse.
   2. Un message entre onglets, à chaque connexion ou déconnexion : les autres
      onglets se rechargent sans attendre leur prochaine requête.
   3. Une vérification auprès du serveur chaque fois que l'onglet redevient
      visible (message manqué, navigateur sans BroadcastChannel).

   Quand le rechargement ne suffit pas (le serveur ne confirme toujours pas
   l'identité), les données restent bloquées et un bandeau le dit : un écran
   vide ne doit pas passer pour une liste vide.

   Une session simplement expirée est déjà traitée par l'intercepteur
   d'axios (401 → page de connexion).
   ══════════════════════════════════════════════════════════════════════ */

const CANAL = 'nirsoft-session'
const EN_TETE = 'x-utilisateur'
// Seules routes dont la réponse réussie peut ne pas porter d'identité : elle ne contient
// qu'un message fixe, jamais une donnée d'utilisateur. « /login » n'y figure pas : sa
// réponse contient le compte connecté et doit donc être signée comme les autres.
const SANS_IDENTITE = ['/logout', '/forgot-password', '/reset-password', '/activate-account']

type Identite = number | null | undefined   // undefined : session pas encore connue ; null : personne
// Pourquoi une réponse est refusée : « absente » (aucune identité dans la réponse) ou « autre » (celle d'un autre compte).
type Refus = 'absente' | 'autre'

// Compte affiché par CET onglet. Mis à jour dans un effet, jamais pendant le rendu.
let identiteAffichee: Identite = undefined

/* ── Ce que le bandeau doit afficher ─────────────────────────────────── */
interface Avis { blocage: Refus | null; reseau: boolean }
let avis: Avis = { blocage: null, reseau: false }
const abonnes = new Set<() => void>()
function publier(suivant: Partial<Avis>) {
  if (Object.entries(suivant).every(([k, v]) => avis[k as keyof Avis] === v)) return
  avis = { ...avis, ...suivant }
  abonnes.forEach(prevenir => prevenir())
}
const sAbonner = (prevenir: () => void) => { abonnes.add(prevenir); return () => { abonnes.delete(prevenir) } }
const lireAvis = () => avis

// Le blocage survit au rechargement de la page : tant qu'aucune réponse n'a prouvé
// l'identité de la session, la page n'est plus rechargée automatiquement et le bandeau
// réapparaît dès le premier refus.
const CLE_BLOCAGE = 'nirsoft-session-bloquee'
let blocageMemorise = false
try { blocageMemorise = sessionStorage.getItem(CLE_BLOCAGE) !== null } catch { /* stockage indisponible */ }
function bloquer(raison: Refus) {
  blocageMemorise = true
  try { sessionStorage.setItem(CLE_BLOCAGE, raison) } catch { /* stockage indisponible : le bandeau suffit */ }
  publier({ blocage: raison })
}
function debloquer() {
  if (avis.blocage === null && !blocageMemorise) return
  blocageMemorise = false
  try { sessionStorage.removeItem(CLE_BLOCAGE) } catch { /* rien à effacer */ }
  publier({ blocage: null })
}

interface ReponseHttp { status?: number; headers?: unknown; config?: { url?: string } }

/** Cette réponse peut-elle être remise aux écrans de l'onglet ? Sinon, la raison du refus. */
function refus(reponse: ReponseHttp | undefined): Refus | null {
  if (!reponse) return null                                   // aucune réponse (réseau coupé) : rien à vérifier, rien à remettre
  const recu = (reponse.headers as Record<string, unknown> | undefined)?.[EN_TETE]
  const signee = recu !== undefined && recu !== null && recu !== ''
  if (typeof identiteAffichee !== 'number') return null       // page de connexion, ou session en cours de résolution : rien à comparer
  if (signee) {                                               // la preuve : l'identité de la réponse elle-même
    if (Number(recu) !== identiteAffichee) return 'autre'
    debloquer()                                               // l'identité de la session est de nouveau prouvée
    return null
  }
  // Réponse non signée alors qu'un compte est affiché. L'absence d'en-tête n'est JAMAIS
  // une preuve d'identité : une réponse de données sans signature est refusée, quel que
  // soit le serveur. L'application exige donc un serveur doté du middleware
  // IdentiteDeLaReponse, et un en-tête lisible par le navigateur (config/cors.php).
  const statut = reponse.status ?? 0
  if (statut < 200 || statut >= 300) return null              // une erreur sans signature ne transporte aucune donnée d'utilisateur
  const chemin = String(reponse.config?.url ?? '').split('?')[0]
  return SANS_IDENTITE.includes(chemin) ? null : 'absente'    // comparaison exacte : aucune autre route n'est exemptée
}

// Recharge la page, au plus trois fois en quinze secondes : si le serveur renvoyait
// durablement une identité incohérente, l'onglet ne tournerait pas en boucle.
// Renvoie faux quand le rechargement est refusé ; l'appelant bloque alors les données.
const CLE_RECHARGEMENTS = 'nirsoft-rechargements-session'
let rechargementDemande = false
function recharger(): boolean {
  if (rechargementDemande) return true                        // déjà demandé pour cette page : plusieurs refus simultanés ne comptent qu'une fois
  try {
    if (sessionStorage.getItem(CLE_BLOCAGE) !== null) return false   // déjà bloqué : recharger n'a rien arrangé
    const maintenant = Date.now()
    const recents = (JSON.parse(sessionStorage.getItem(CLE_RECHARGEMENTS) || '[]') as number[]).filter(t => maintenant - t < 15000)
    if (recents.length >= 3) return false
    sessionStorage.setItem(CLE_RECHARGEMENTS, JSON.stringify([...recents, maintenant]))
  } catch {
    return false                                              // stockage indisponible : rien ne bornerait les rechargements, on n'en lance aucun
  }
  rechargementDemande = true
  window.location.reload()
  return true
}
// La session n'est plus celle de l'onglet : rechargement, ou blocage visible s'il est refusé.
const rechargerOuBloquer = (raison: Refus) => { if (!recharger()) bloquer(raison) }

const MESSAGES: Record<Refus, string> = {
  absente: 'Identité de session non vérifiée : les données sont bloquées.',
  autre:   'La session a changé : les données sont bloquées.',
}

// La réponse d'une autre session n'est remise à personne. Pendant que la page se
// recharge, la promesse reste en attente : aucun écran ne reçoit ni ces données, ni
// une erreur à afficher. Si le rechargement est refusé (garde-fou ci-dessus), l'appel
// échoue et le bandeau s'affiche : les données ne sont toujours pas remises.
function ecarter<T>(raison: Refus): Promise<T> {
  if (recharger()) return new Promise<T>(() => {})
  bloquer(raison)
  return Promise.reject(new Error(MESSAGES[raison]))
}

// Posé une seule fois, au chargement de ce module — donc avant toute requête de
// l'application. Les refus (403, 422…) sont vérifiés comme les succès, AVANT d'être
// transmis aux écrans.
const intercepteur = api.interceptors.response.use(
  reponse => {
    publier({ reseau: false })                                // le serveur répond
    const raison = refus(reponse)
    return raison ? ecarter<typeof reponse>(raison) : reponse
  },
  erreur => {
    // Aucune réponse du tout, hors requête annulée par l'application : serveur ou réseau indisponible.
    if (erreur?.response) publier({ reseau: false })
    else if (erreur?.code !== 'ERR_CANCELED') publier({ reseau: true })
    const raison = refus(erreur?.response)
    return raison ? ecarter<never>(raison) : Promise.reject(erreur)
  },
)
// En développement, le rechargement à chaud de ce fichier ne doit pas empiler les intercepteurs.
if (import.meta.hot) import.meta.hot.dispose(() => api.interceptors.response.eject(intercepteur))

const TEXTES = {
  absente: { titre: 'Identité de session non vérifiée — données bloquées.', detail: "Le serveur n'a pas confirmé à quel compte appartiennent les données : elles ne sont pas affichées. Un écran vide ne signifie pas qu'il n'y a aucune donnée." },
  autre:   { titre: 'La session a changé dans ce navigateur — données bloquées.', detail: "Un autre compte est connecté dans un autre onglet : ses données ne sont pas affichées ici. Rechargez la page pour continuer." },
  reseau:  { titre: 'Serveur injoignable.', detail: "Le serveur ou le réseau ne répond pas : les données affichées peuvent être incomplètes ou anciennes." },
}

export default function SentinelleSession() {
  const { user, loading } = useAuth()
  const identite: Identite = loading ? undefined : (user?.id ?? null)
  const canal = useRef<BroadcastChannel | null>(null)
  const { blocage, reseau } = useSyncExternalStore(sAbonner, lireAvis)

  // Écoute des autres onglets, pour toute la durée de vie de l'application.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const c = new BroadcastChannel(CANAL)
    canal.current = c
    c.onmessage = (evenement: MessageEvent) => {
      const autre = (evenement.data as { identite?: number | null } | null)?.identite
      // Tant que cet onglet ne connaît pas encore sa session, il n'a rien à comparer.
      if (identiteAffichee !== undefined && autre !== undefined && autre !== identiteAffichee) rechargerOuBloquer('autre')
    }
    return () => { c.close(); canal.current = null }
  }, [])

  // Cet onglet vient de changer d'identité (connexion ou déconnexion) : il prévient les autres.
  // La toute première identité connue n'est pas un changement : rien n'est envoyé au chargement.
  useEffect(() => {
    const precedente = identiteAffichee
    identiteAffichee = identite
    if (identite === null) debloquer()                        // plus personne n'est affiché : il n'y a plus de données à bloquer
    if (identite === undefined || precedente === undefined || precedente === identite) return
    canal.current?.postMessage({ identite })
  }, [identite])

  // Retour sur l'onglet : la session du navigateur est-elle toujours celle que cet
  // onglet affiche ? Si elle a changé, la page est rechargée (par la vérification des
  // réponses ci-dessus : la réponse de « /user » porte alors une autre identité) ;
  // si elle est terminée, l'intercepteur d'axios renvoie à la connexion ; si le réseau
  // est coupé, on ne sait rien et l'onglet reste tel quel, avec ses propres données.
  useEffect(() => {
    const verifier = () => {
      const attendue = identiteAffichee
      if (document.visibilityState !== 'visible' || typeof attendue !== 'number') return
      api.get('/user')
        .then(res => { if (res.data?.id !== attendue && identiteAffichee === attendue) rechargerOuBloquer('autre') })
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', verifier)
    window.addEventListener('focus', verifier)
    return () => { document.removeEventListener('visibilitychange', verifier); window.removeEventListener('focus', verifier) }
  }, [])

  // Le blocage de sécurité l'emporte sur la panne réseau ; sans l'un ni l'autre, rien n'est affiché.
  const texte = blocage ? TEXTES[blocage] : reseau ? TEXTES.reseau : null
  if (!texte) return null
  // Panne réseau : simple avertissement, en bas à droite, qui ne recouvre ni la barre
  // supérieure ni les onglets et peut être fermé. Il revient à la prochaine requête
  // restée sans réponse, et s'efface de lui-même dès que le serveur répond.
  if (!blocage) return (
    <div role="alert" data-avis="reseau" style={{ position:'fixed', right:16, bottom:16, zIndex:10000, maxWidth:420, background:'#b45309', color:'#fff', padding:'10px 14px', borderRadius:8, fontSize:13, display:'flex', alignItems:'center', gap:12, boxShadow:'0 2px 8px rgba(0,0,0,.25)' }}>
      <span style={{ flex:1 }}><strong>{texte.titre}</strong> {texte.detail}</span>
      <button type="button" onClick={() => publier({ reseau: false })} style={{ background:'transparent', color:'#fff', border:'1px solid rgba(255,255,255,.6)', borderRadius:6, padding:'4px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
        Fermer
      </button>
    </div>
  )
  const couleur = '#b91c1c'
  return (
    <div role="alert" data-avis={blocage} style={{ position:'fixed', top:0, left:0, right:0, zIndex:10000, background:couleur, color:'#fff', padding:'10px 16px', fontSize:13, display:'flex', alignItems:'center', gap:12, boxShadow:'0 2px 8px rgba(0,0,0,.25)' }}>
      <span style={{ flex:1 }}><strong>{texte.titre}</strong> {texte.detail}</span>
      <button type="button" onClick={() => window.location.reload()} style={{ background:'#fff', color:couleur, border:'none', borderRadius:6, padding:'6px 12px', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
        Recharger la page
      </button>
    </div>
  )
}
