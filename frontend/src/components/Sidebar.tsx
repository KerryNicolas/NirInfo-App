import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props { section: 'formation' | 'etudiant' | 'facture' }

/* ── Icônes SVG ── */
const SvgHamburger = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6"  x2="21" y2="6"/>
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)
const SvgClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6"  y1="6" x2="18" y2="18"/>
  </svg>
)
const SvgModule = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const SvgSession = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
)
const SvgEtudiant = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const SvgFacture = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)
const SvgEtat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
  </svg>
)
const SvgEcheance = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const SvgCertif = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
  </svg>
)
const SvgRetour = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
)
const SvgLogout = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)
const SvgSettings = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const menuItems = [
  { label: 'Module',        to: '/formation/module',  icon: <SvgModule /> },
  { label: 'Session',       to: '/formation/session', icon: <SvgSession /> },
  { label: 'Etudiant',      to: '/etudiant/etudiant', icon: <SvgEtudiant /> },

  // C'est ici
  { label: 'Facture',       to: '/facture',            icon: <SvgFacture /> },
  // {label: 'Atoko',          to: '/Dasb',                icon: <.../>}


  { label: 'Etat',          to: '/etat',               icon: <SvgEtat /> },
  { label: 'Echéance',      to: '/echéance',           icon: <SvgEcheance /> },
  { label: 'Certification', to: '/certification',      icon: <SvgCertif /> },
  { label: 'Retour',        to: '/dashboard',          icon: <SvgRetour /> },
]

const STORAGE_KEY = 'nirinfo_sidebar_open'

export default function Sidebar({ section }: Props) {
  const { logout } = useAuth()
  const navigate   = useNavigate()

  // État mémorisé dans localStorage — ouvert par défaut
  const [open, setOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === null ? true : saved === 'true'
  })

  // Persiste l'état à chaque changement
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(open))
  }, [open])

  // Ferme avec Échap
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggle = () => setOpen(p => !p)

  return (
    <>
      {/* ── Overlay (mobile / sidebar ouverte) ── */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            display: 'none', // visible seulement sur mobile via CSS
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 39,
          }}
          className="sidebar-overlay"
        />
      )}

      {/* ── Sidebar ── */}
      <div
        className="sidebar"
        style={{
          width:      open ? 210 : 52,
          minWidth:   open ? 210 : 52,
          overflow:   'hidden',
          transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)',
          flexShrink: 0,
        }}
      >
        {/* ── Logo + bouton hamburger ── */}
        <div className="sidebar-logo" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'space-between' : 'center',
          padding: open ? '0 12px 0 16px' : '0',
          gap: 8,
          overflow: 'hidden',
          minHeight: 54,
        }}>
          {/* Logo (caché quand fermé) */}
          {open && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              {/* <div className="logo-icon" style={{ flexShrink: 0 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
              </div> */}
              <span style={{
                fontWeight: 700, fontSize: 15, color: 'white',
                whiteSpace: 'nowrap', overflow: 'hidden',
              }}>
            Formations
              </span>
            </div>
          )}

          {/* Bouton hamburger / fermer */}
          <button
            onClick={toggle}
            title={open ? 'Réduire le menu' : 'Ouvrir le menu'}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 7,
              color: 'rgba(255,255,255,0.85)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32, height: 32,
              flexShrink: 0,
              transition: 'background 0.15s',
              padding: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.16)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            {open ? <SvgClose /> : <SvgHamburger />}
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="sidebar-nav" style={{ overflow: 'hidden' }}>
          {menuItems.map((m) => {
            const isSeparator = m.label === 'Retour'
            return (
              <div key={m.label}>
                {isSeparator && (
                  <div style={{
                    height: 1,
                    background: 'rgba(255,255,255,0.07)',
                    margin: open ? '6px 16px' : '6px 10px',
                    transition: 'margin 0.2s',
                  }} />
                )}
                <NavLink
                  to={m.to}
                  className={({ isActive }) => isActive ? 'active' : ''}
                  title={!open ? m.label : undefined}
                  style={{
                    justifyContent: open ? 'flex-start' : 'center',
                    padding: open ? '9px 16px' : '9px 0',
                    gap: open ? 10 : 0,
                    transition: 'padding 0.2s, justify-content 0.2s',
                  }}
                >
                  <span className="nav-icon" style={{ flexShrink: 0 }}>{m.icon}</span>
                  {/* Label — disparaît avec une transition opacity */}
                  <span style={{
                    opacity:    open ? 1 : 0,
                    maxWidth:   open ? 160 : 0,
                    overflow:   'hidden',
                    whiteSpace: 'nowrap',
                    transition: 'opacity 0.18s, max-width 0.22s',
                  }}>
                    {m.label}
                  </span>
                </NavLink>
              </div>
            )
          })}
        </nav>

        {/* ── Footer ── */}
        <div className="sidebar-footer" style={{
          padding: open ? '8px 12px' : '8px 6px',
          transition: 'padding 0.2s',
        }}>
          {/* Paramètres */}
          <button
            onClick={() => navigate('/profile')}
            title={!open ? 'Paramètres' : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: open ? 'flex-start' : 'center',
              gap: open ? 7 : 0,
              marginBottom: 6,
              background: 'rgba(255,255,255,0.06)',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: open ? '7px 10px' : '7px',
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            <SvgSettings />
            <span style={{
              opacity:  open ? 1 : 0,
              maxWidth: open ? 120 : 0,
              overflow: 'hidden',
              transition: 'opacity 0.18s, max-width 0.22s',
            }}>
              Paramètres
            </span>
          </button>

          {/* Déconnexion */}
          <button
            onClick={() => { logout(); navigate('/login') }}
            title={!open ? 'Déconnexion' : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: open ? 'flex-start' : 'center',
              gap: open ? 7 : 0,
              background: 'rgba(239,68,68,0.12)',
              color: '#fca5a5',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8,
              padding: open ? '7px 10px' : '7px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            <SvgLogout />
            <span style={{
              opacity:  open ? 1 : 0,
              maxWidth: open ? 120 : 0,
              overflow: 'hidden',
              transition: 'opacity 0.18s, max-width 0.22s',
            }}>
              Déconnexion
            </span>
          </button>
        </div>
      </div>
    </>
  )
}


