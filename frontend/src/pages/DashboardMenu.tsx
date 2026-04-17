import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/axios'
import Logo from '../assets/logo.png'

// ── Icônes ──────────────────────────────────────────────────────────────────
const IcoGrad      = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
const IcoLogoutRed = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
const IcoSettings  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
const IcoFormation = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
const IcoTruck     = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v3h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
const IcoUsers     = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
const IcoServices  = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
const IcoBudget    = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>

// ── Menu items ───────────────────────────────────────────────────────────────
const menuItems = [
  { label: 'Formations',        to: '/formation',  icon: <IcoFormation />, active: true  },
  { label: 'Logistiques',       to: '/logistique', icon: <IcoTruck />,     active: true  },
  { label: 'Personnel',         to: '/personnel',  icon: <IcoUsers />,     active: true  },
  { label: 'Services',          to: '#',           icon: <IcoServices />,  active: false },
  { label: 'Gestion du budget', to: '#',           icon: <IcoBudget />,    active: false },
]

// ── Interfaces ───────────────────────────────────────────────────────────────
interface Stats {
  total_etudiants: number
  sessions_actives: number
  inscriptions_mois: number
  revenus_mois: number
}

// ── Composant principal ──────────────────────────────────────────────────────
export default function DashboardMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => { await logout(); navigate('/login') }
  const initials = (user?.name || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>

      {/* ── Top bar ── */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 28px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 50 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 70, height: 32 }}>
            <img src={Logo} alt="Logo" width={302} height={32} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Bonjour, <b style={{ color: '#1e293b' }}>{user?.name}</b></span>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#1e3a8a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>
            {initials}
          </div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            <IcoLogoutRed /> Déconnexion
          </button>
        </div>
      </div>

      {/* ── Zone principale : menu centré ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 54px)', padding: 24 }}>
        <div style={{ width:  290}}>
          {/* 270 */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>

            {/* En-tête du menu */}
            <div style={{ background: 'linear-gradient(145deg,#0f172a 0%,#00315F 100%)', padding: '20px 18px 16px', textAlign: 'center' }}>
              <h2 style={{ color: 'white', fontSize: 15, fontWeight: 700, margin: 0 }}>Menu principal</h2>
            </div>

            {/* Items du menu */}
            <div style={{ padding: '10px 10px 6px' }}>
              {menuItems.map(m => (
                m.active ? (
                  <Link
                    key={m.label}
                    to={m.to}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 9, marginBottom: 4, background: '', color: '#374151', textDecoration: 'none', fontSize: 13.5, fontWeight: 600, border: '1px solid #e2e8f0', transition: 'all 0.15s' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLAnchorElement).style.background = '#a6c8ff'
                      ;(e.currentTarget as HTMLAnchorElement).style.borderColor = '#bfdbfe'
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLAnchorElement).style.background = 'white'
                      ;(e.currentTarget as HTMLAnchorElement).style.borderColor = '#e2e8f0'
                    }}
                  >
                    <span style={{ display: 'flex', opacity: 0.7 }}>{m.icon}</span>
                    {m.label}
                  </Link>
                ) : (
                  <div
                    key={m.label}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 9, marginBottom: 4, color: '#94a3b8', fontSize: 13.5, cursor: 'not-allowed', justifyContent: 'space-between', border: '1px solid #f1f5f9', background: '#fafbfc' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.6 }}>
                      <span style={{ display: 'flex' }}>{m.icon}</span>
                      {m.label}
                    </div>
                    <span style={{ fontSize: 9.5, background: '#f1f5f9', color: '#94a3b8', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>bientôt</span>
                  </div>
                )
              ))}
            </div>

            {/* Pied du menu */}
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', background: '#fafbfc' }}>
              <button
                onClick={() => navigate('/profile')}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '5px 8px', borderRadius: 6 }}
              >
                <IcoSettings /> Paramètres
              </button>
              <button
                onClick={handleLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 7, padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <IcoLogoutRed /> Déconnexion
              </button>
            </div>

          </div>
        </div>
      </div>

    </div>
  )
}