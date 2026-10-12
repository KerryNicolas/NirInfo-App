import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  SvgModule, SvgSession, SvgEtudiant, SvgFacture, SvgEtat, SvgEcheance, SvgCertif,
  SvgRetour, SvgHamburger, SvgSettings, SvgLogout,
  IcoUsers, IcoServices, IcoStudent, IcoBudget, IcoCart, IcoCharge, IcoFunc
} from '.././components/icons'

// FIX : un item de menu pointe soit vers une route ("to", géré par NavLink,
// pour les sections qui ont une page/route par onglet — Formation, Services,
// Budgets), soit vers un onglet interne à la page ("tab", pour une section
// comme Logistique qui garde tout dans une seule route et bascule son
// contenu localement). onTabChange/activeTab ne sont utilisés que dans ce
// second cas.
// FIX : flèche pointant vers la gauche pour la fermeture du menu — remplace
// le "X" (SvgClose) par une icône plus parlante en UX pour un panneau qui
// se replie vers la gauche. Définie ici en local pour ne pas dépendre d'un
// ajout dans components/icons.tsx.
function SvgArrowLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

interface MenuItem { label: string; to?: string; tab?: string; icon: JSX.Element }

interface Props {
  section: 'formation' | 'etudiant' | 'facture' | 'services' | 'budgets' | 'logistique' | 'personnel'
  activeTab?: string
  onTabChange?: (tab: string) => void
}

// FIX : menus par section — Formation inchangé, Services et Budgets ajoutés,
// Logistique ajoutée (basée sur des onglets internes, pas des routes).
const formationMenuItems: MenuItem[] = [
  { label: 'Module',        to: '/formation/module',  icon: <SvgModule /> },
  { label: 'Session',       to: '/formation/session', icon: <SvgSession /> },
  { label: 'Etudiant',      to: '/etudiant/etudiant', icon: <SvgEtudiant /> },
  { label: 'Facture',       to: '/facture',           icon: <SvgFacture /> },
  { label: 'Etat',          to: '/etat',              icon: <SvgEtat /> },
  { label: 'Echéance',      to: '/echeance',          icon: <SvgEcheance /> },
  { label: 'Certification', to: '/certification',     icon: <SvgCertif /> },
  { label: 'Menu Principal',        to: '/dashboard',         icon: <SvgRetour /> },
]

const menuItemsBySection: Record<Props['section'], MenuItem[]> = {
  // FIX : formation/etudiant/facture partagent le même menu — le prop "section" ne sert
  // qu'à choisir le titre affiché, jamais à changer le contenu du menu (comportement d'origine)
  formation: formationMenuItems,
  etudiant:  formationMenuItems,
  facture:   formationMenuItems,
  services: [
    { label: 'Clients',       to: '/services/clients',      icon: <IcoUsers /> },
    { label: 'Catalogue',     to: '/services/catalogue',     icon: <IcoServices /> },
    { label: 'Prestation',    to: '/services/prestation',    icon: <IcoStudent /> },
    { label: 'Recouvrement',  to: '/services/recouvrement',  icon: <SvgEcheance /> },
    { label: 'Menu Principal',        to: '/dashboard',              icon: <SvgRetour /> },
  ],
  budgets: [
    { label: 'Compte',    to: '/budgets/comptes',    icon: <SvgFacture /> },
    { label: 'Gestion',   to: '/budgets/gerer',      icon: <IcoBudget /> },
    { label: 'Virement',  to: '/budgets/transferts', icon: <SvgSession /> },
    { label: 'Trésorerie', to: '/budgets/tresorerie', icon: <SvgEtat /> },
    { label: 'Menu Principal',    to: '/dashboard',          icon: <SvgRetour /> },
  ],
  // FIX : Logistique n'a qu'une seule route — Achat/Charge sont des onglets
  // internes (via activeTab/onTabChange), pas des pages séparées. Ces items
  // n'ont donc pas de "to", sauf le retour au menu principal.
  logistique: [
    { label: 'Achat',  tab: 'achat',  icon: <IcoCart /> },
    { label: 'Charge', tab: 'charge', icon: <IcoCharge /> },
    { label: 'Menu Principal', to: '/dashboard', icon: <SvgRetour /> },
  ],
  // FIX : même principe pour Personnel — Personnel/Fonctions sont des onglets
  // internes à la page, pas des routes séparées.
  personnel: [
    { label: 'Personnel', tab: 'personnel', icon: <IcoUsers /> },
    { label: 'Fonctions', tab: 'fonction',  icon: <IcoFunc /> },
    { label: 'Menu Principal', to: '/dashboard', icon: <SvgRetour /> },
  ],
}

const sectionTitle: Record<Props['section'], string> = {
  formation:  'Formations',
  etudiant:   'Formations',
  facture:    'Formations',
  services:   'Services',
  budgets:    'Budgets',
  logistique: 'Logistique',
  personnel:  'Personnel',
}

const STORAGE_KEY = 'nirinfo_sidebar_open'
// FIX (mobile) : même seuil que le breakpoint CSS .sidebar dans index.css
// (@media max-width: 768px) — doit rester synchronisé avec ce fichier.
const MOBILE_BREAKPOINT = 768

export default function Sidebar({ section, activeTab, onTabChange }: Props) {
  const { logout } = useAuth()
  const navigate   = useNavigate()
  const menuItems  = menuItemsBySection[section]

  const [open, setOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) return saved === 'true'
    // FIX (mobile) : aucune préférence enregistrée pour l'instant — replié
    // par défaut sur petit écran (le panneau plein écran par-dessus le
    // contenu serait gênant à la première visite), ouvert par défaut sur
    // desktop comme avant. Ne change rien pour un utilisateur qui a déjà
    // une préférence sauvegardée, sur aucune taille d'écran.
    return typeof window === 'undefined' || window.innerWidth > MOBILE_BREAKPOINT
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(open))
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggle = () => setOpen(p => !p)

  // FIX (mobile) : sur petit écran, le menu devient un panneau superposé
  // (overlay) plutôt qu'une colonne qui pousse le contenu — voir index.css
  // (@media max-width: 768px). Une fois qu'on a choisi une page dans ce
  // mode, on referme automatiquement le panneau pour révéler le contenu,
  // sinon l'utilisateur devrait fermer manuellement à chaque navigation.
  // Ne fait rien sur desktop (le panneau reste ouvert/fermé comme avant).
  const closeIfMobile = () => {
    if (typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT) setOpen(false)
  }

  return (
    <>
      {/* FIX (mobile) : bouton hamburger persistant, toujours cliquable même
          quand le panneau est réduit à 0px de large sur petit écran (le
          bouton habituel dans l'en-tête du sidebar disparaît alors avec
          lui). Invisible sur desktop — voir index.css. Affiché uniquement
          quand le menu est fermé, comme un vrai bouton d'ouverture ;
          une fois ouvert, le bouton flèche déjà présent dans l'en-tête du
          sidebar sert à refermer, exactement comme sur desktop. */}
      {!open && (
        <button
          onClick={toggle}
          title="Ouvrir le menu"
          className="mobile-sidebar-toggle"
        >
          <SvgHamburger />
        </button>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="sidebar-overlay"
        />
      )}

      <div
        className={`sidebar ${open ? 'sidebar-open' : 'sidebar-closed'}`}
        style={{
          width:      open ? 210 : 52,
          minWidth:   open ? 210 : 52,
          overflow:   'hidden',
          transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)',
          flexShrink: 0,
        }}
      >
        <div className="sidebar-logo" style={{
          display: 'flex', alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          padding: open ? '0 12px 0 16px' : '0', gap: 8, overflow: 'hidden', minHeight: 54,
        }}>
          {open && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                {sectionTitle[section]}
              </span>
            </div>
          )}
          <button
            onClick={toggle}
            title={open ? 'Réduire le menu' : 'Ouvrir le menu'}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 7, color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, flexShrink: 0, transition: 'background 0.15s', padding: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            {open ? <SvgArrowLeft /> : <SvgHamburger />}
          </button>
        </div>

        <nav className="sidebar-nav" style={{ overflow: 'hidden' }}>
          {menuItems.map((m) => {
            const isSeparator = m.label === 'Retour'
            const navStyle: React.CSSProperties = {
              justifyContent: open ? 'flex-start' : 'center',
              padding: open ? '9px 16px' : '9px 0',
              gap: open ? 10 : 0,
              transition: 'padding 0.2s, justify-content 0.2s',
            }
            return (
              <div key={m.label}>
                {isSeparator && (
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: open ? '6px 16px' : '6px 10px', transition: 'margin 0.2s' }} />
                )}
                {m.to ? (
                  <NavLink
                    to={m.to}
                    className={({ isActive }) => isActive ? 'active' : ''}
                    title={!open ? m.label : undefined}
                    style={navStyle}
                    onClick={closeIfMobile}
                  >
                    <span className="nav-icon" style={{ flexShrink: 0 }}>{m.icon}</span>
                    <span style={{
                      opacity: open ? 1 : 0, maxWidth: open ? 160 : 0, overflow: 'hidden',
                      whiteSpace: 'nowrap', transition: 'opacity 0.18s, max-width 0.22s',
                    }}>
                      {m.label}
                    </span>
                  </NavLink>
                ) : (
                  <button
                    type="button"
                    onClick={() => { m.tab && onTabChange?.(m.tab); closeIfMobile() }}
                    className={activeTab === m.tab ? 'active' : ''}
                    title={!open ? m.label : undefined}
                    style={navStyle}
                  >
                    <span className="nav-icon" style={{ flexShrink: 0 }}>{m.icon}</span>
                    <span style={{
                      opacity: open ? 1 : 0, maxWidth: open ? 160 : 0, overflow: 'hidden',
                      whiteSpace: 'nowrap', transition: 'opacity 0.18s, max-width 0.22s',
                    }}>
                      {m.label}
                    </span>
                  </button>
                )}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer" style={{ padding: open ? '8px 12px' : '8px 6px', transition: 'padding 0.2s' }}>
          <button
            onClick={() => { navigate('/profile'); closeIfMobile() }}
            title={!open ? 'Paramètres' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: open ? 'flex-start' : 'center', gap: open ? 7 : 0, marginBottom: 6,
              background: 'rgba(255,255,255,0.06)', color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
              padding: open ? '7px 10px' : '7px', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}
          >
            <SvgSettings />
            <span style={{ opacity: open ? 1 : 0, maxWidth: open ? 120 : 0, overflow: 'hidden', transition: 'opacity 0.18s, max-width 0.22s' }}>
              Paramètres
            </span>
          </button>

          <button
            onClick={() => { logout(); navigate('/login') }}
            title={!open ? 'Déconnexion' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: open ? 'flex-start' : 'center', gap: open ? 7 : 0,
              background: 'rgba(239,68,68,0.12)', color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
              padding: open ? '7px 10px' : '7px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              overflow: 'hidden', whiteSpace: 'nowrap',
            }}
          >
            <SvgLogout />
            <span style={{ opacity: open ? 1 : 0, maxWidth: open ? 120 : 0, overflow: 'hidden', transition: 'opacity 0.18s, max-width 0.22s' }}>
              Déconnexion
            </span>
          </button>
        </div>
      </div>
    </>
  )
}