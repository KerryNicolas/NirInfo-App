import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  SvgModule, SvgSession, SvgEtudiant, SvgFacture, SvgEtat, SvgEcheance, SvgCertif,
  SvgRetour, SvgClose, SvgHamburger, SvgSettings, SvgLogout,
  IcoUsers, IcoServices, IcoStudent, IcoBudget
} from '.././components/icons'

interface Props { section: 'formation' | 'etudiant' | 'facture' | 'services' | 'budgets' }

// FIX : menus par section — Formation inchangé, Services et Budgets ajoutés
const formationMenuItems = [
  { label: 'Module',        to: '/formation/module',  icon: <SvgModule /> },
  { label: 'Session',       to: '/formation/session', icon: <SvgSession /> },
  { label: 'Etudiant',      to: '/etudiant/etudiant', icon: <SvgEtudiant /> },
  { label: 'Facture',       to: '/facture',           icon: <SvgFacture /> },
  { label: 'Etat',          to: '/etat',              icon: <SvgEtat /> },
  { label: 'Echéance',      to: '/echéance',          icon: <SvgEcheance /> },
  { label: 'Certification', to: '/certification',     icon: <SvgCertif /> },
  { label: 'Retour',        to: '/dashboard',         icon: <SvgRetour /> },
]

const menuItemsBySection: Record<Props['section'], { label: string; to: string; icon: JSX.Element }[]> = {
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
    { label: 'Retour',        to: '/dashboard',              icon: <SvgRetour /> },
  ],
  budgets: [
    { label: 'Compte',    to: '/budgets/comptes',    icon: <SvgFacture /> },
    { label: 'Gestion',   to: '/budgets/gerer',      icon: <IcoBudget /> },
    { label: 'Virement',  to: '/budgets/transferts', icon: <SvgSession /> },
    { label: 'Retour',    to: '/dashboard',          icon: <SvgRetour /> },
  ],
}

const sectionTitle: Record<Props['section'], string> = {
  formation: 'Formations',
  etudiant:  'Formations',
  facture:   'Formations',
  services:  'Services',
  budgets:   'Budgets',
}

const STORAGE_KEY = 'nirinfo_sidebar_open'

export default function Sidebar({ section }: Props) {
  const { logout } = useAuth()
  const navigate   = useNavigate()
  const menuItems  = menuItemsBySection[section]

  const [open, setOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === null ? true : saved === 'true'
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

  return (
    <>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ display: 'none', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 39 }}
          className="sidebar-overlay"
        />
      )}

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
            {open ? <SvgClose /> : <SvgHamburger />}
          </button>
        </div>

        <nav className="sidebar-nav" style={{ overflow: 'hidden' }}>
          {menuItems.map((m) => {
            const isSeparator = m.label === 'Retour'
            return (
              <div key={m.label}>
                {isSeparator && (
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: open ? '6px 16px' : '6px 10px', transition: 'margin 0.2s' }} />
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
                  <span style={{
                    opacity: open ? 1 : 0, maxWidth: open ? 160 : 0, overflow: 'hidden',
                    whiteSpace: 'nowrap', transition: 'opacity 0.18s, max-width 0.22s',
                  }}>
                    {m.label}
                  </span>
                </NavLink>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-footer" style={{ padding: open ? '8px 12px' : '8px 6px', transition: 'padding 0.2s' }}>
          <button
            onClick={() => navigate('/profile')}
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