import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/axios'

interface Stats {
  total_etudiants: number; sessions_actives: number
  inscriptions_mois: number; revenus_mois: number
}
interface Inscription {
  id_paiement: number; matricule: string; nom_complet: string
  code_session: string; date_paiement: string; montant_paye: number; reste: number
}

/* ── Icônes top bar ── */
const IcoGrad = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
)
const IcoLogoutRed = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

/* ── Icônes menu SVG ── */
const IcoFormation = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)
const IcoTruck = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13" rx="1"/>
    <path d="M16 8h4l3 5v3h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
)
const IcoUsers = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const IcoServices = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
  </svg>
)
const IcoBudget = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
)
const IcoSettings = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const menuItems = [
  { label: 'Formations',        to: '/formation', icon: <IcoFormation />, active: true  },
  { label: 'Logistiques',       to: '#',          icon: <IcoTruck />,    active: false },
  { label: 'Personnel',         to: '#',          icon: <IcoUsers />,    active: false },
  { label: 'Services',          to: '#',          icon: <IcoServices />, active: false },
  { label: 'Gestion du budget', to: '#',          icon: <IcoBudget />,   active: false },
]

/* ── État vide illustré ── */
function EmptyInscriptions({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ marginBottom: 20 }}>
        <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
          <rect x="10" y="55" width="100" height="6" rx="2" fill="#e2e8f0"/>
          <rect x="15" y="61" width="4" height="28" rx="1" fill="#cbd5e1"/>
          <rect x="101" y="61" width="4" height="28" rx="1" fill="#cbd5e1"/>
          <rect x="35" y="18" width="50" height="65" rx="4" fill="white" stroke="#e2e8f0" strokeWidth="1.5"/>
          <rect x="43" y="28" width="34" height="3" rx="1.5" fill="#bfdbfe"/>
          <rect x="43" y="36" width="26" height="2.5" rx="1.2" fill="#e2e8f0"/>
          <rect x="43" y="43" width="30" height="2.5" rx="1.2" fill="#e2e8f0"/>
          <rect x="43" y="50" width="22" height="2.5" rx="1.2" fill="#e2e8f0"/>
          <rect x="43" y="57" width="28" height="2.5" rx="1.2" fill="#e2e8f0"/>
          <circle cx="82" cy="72" r="12" fill="white" stroke="#93c5fd" strokeWidth="2"/>
          <circle cx="82" cy="72" r="7" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1.2"/>
          <line x1="90" y1="80" x2="97" y2="87" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round"/>
          <text x="82" y="76" textAnchor="middle" fontSize="8" fill="#2563eb" fontWeight="700">?</text>
        </svg>
      </div>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Aucune inscription enregistrée</p>
      <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, maxWidth: 280, marginBottom: 20 }}>
        Les nouvelles inscriptions apparaîtront ici automatiquement dès qu'un étudiant sera inscrit à une session.
      </p>
      <button onClick={onNavigate} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: '#1e40af', color: 'white', border: 'none', borderRadius: 9,
        padding: '9px 18px', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: '0 2px 8px rgba(30,64,175,0.3)',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Inscrire un étudiant
      </button>
    </div>
  )
}

export default function DashboardMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats]               = useState<Stats | null>(null)
  const [inscriptions, setInscriptions] = useState<Inscription[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    // Silencieux — aucune notification au chargement
    api.get('/dashboard/stats')
      .then(r => {
        setStats(r.data.stats ?? r.data)
        setInscriptions(r.data.dernieres_inscriptions ?? [])
      })
      .catch(() => {
        setStats({ total_etudiants: 0, sessions_actives: 0, inscriptions_mois: 0, revenus_mois: 0 })
        setInscriptions([])
      })
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => { await logout(); navigate('/login') }
  const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n)
  const initials = (user?.name || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>

      {/* ── Top bar ── */}
      <div style={{
        background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 28px', height: 54,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#1e40af', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 2px 8px rgba(30,64,175,0.3)' }}>
            <IcoGrad />
          </div>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Nir'Info</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Bonjour, <b style={{ color: '#1e293b' }}>{user?.name}</b></span>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1e3a8a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 11, fontWeight: 700 }}>
            {initials}
          </div>
          {/* Bouton déconnexion stylisé */}
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#fef2f2', color: '#dc2626',
            border: '1px solid #fecaca', borderRadius: 8,
            padding: '6px 12px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}>
            <IcoLogoutRed /> Déconnexion
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', gap: 22, padding: '24px 28px', maxWidth: 1280, margin: '0 auto' }}>

        {/* ── Menu principal ── */}
        <div style={{ width: 270, flexShrink: 0 }}>
          <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 100%)', padding: '18px 18px 14px' }}>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Navigation</p>
              <h2 style={{ color: 'white', fontSize: 15, fontWeight: 700, margin: 0 }}>Menu principal</h2>
            </div>

            {/* Boutons avec icônes SVG */}
            <div style={{ padding: '10px 10px 6px' }}>
              {menuItems.map(m => (
                m.active ? (
                  <Link key={m.label} to={m.to} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 9, marginBottom: 4,
                    background: 'linear-gradient(135deg, #1e40af, #2563eb)',
                    color: 'white', textDecoration: 'none', fontSize: 13.5, fontWeight: 600,
                    boxShadow: '0 2px 10px rgba(30,64,175,0.3)',
                  }}>
                    <span style={{ opacity: 0.9, display: 'flex' }}>{m.icon}</span>
                    {m.label}
                    <span style={{ marginLeft: 'auto', fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 10 }}>Actif</span>
                  </Link>
                ) : (
                  <div key={m.label} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px', borderRadius: 9, marginBottom: 4,
                    color: '#94a3b8', fontSize: 13.5, cursor: 'not-allowed',
                    justifyContent: 'space-between', border: '1px dashed #e2e8f0',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.6 }}>
                      <span style={{ display: 'flex' }}>{m.icon}</span>
                      {m.label}
                    </div>
                    <span style={{ fontSize: 9.5, background: '#f1f5f9', color: '#94a3b8', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>bientôt</span>
                  </div>
                )
              ))}
            </div>

            {/* Footer menu — déconnexion stylisée comme en haut */}
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', background: '#fafbfc' }}>
              <button onClick={() => navigate('/profile')} style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                color: '#64748b', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', padding: '5px 8px', borderRadius: 6,
              }}>
                <IcoSettings /> Paramètres
              </button>
              {/* Même style que le bouton déconnexion du top bar */}
              <button onClick={handleLogout} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#fef2f2', color: '#dc2626',
                border: '1px solid #fecaca', borderRadius: 7,
                padding: '5px 10px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}>
                <IcoLogoutRed /> Déconnexion
              </button>
            </div>
          </div>
        </div>

        {/* ── Contenu principal ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div className="loading-center"><div className="spinner" /> Chargement…</div>
          ) : (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
                {[
                  { label: 'Total Étudiants',   value: fmt(stats?.total_etudiants ?? 0),      color: '#2563eb', bg: '#eff6ff',
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
                  { label: 'Sessions actives',  value: fmt(stats?.sessions_actives ?? 0),     color: '#16a34a', bg: '#f0fdf4',
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> },
                  { label: 'Inscriptions/mois', value: fmt(stats?.inscriptions_mois ?? 0),    color: '#ea580c', bg: '#fff7ed',
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> },
                  { label: 'Revenus du mois',   value: fmt(stats?.revenus_mois ?? 0) + ' Ar', color: '#7c3aed', bg: '#f5f3ff',
                    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M8.5 9.5a3.5 3.5 0 0 1 7 0c0 2-3.5 3-3.5 3s-3.5 1-3.5 3a3.5 3.5 0 0 0 7 0"/></svg> },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <div style={{ width: 46, height: 46, borderRadius: 11, background: s.bg, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
                    <div className="stat-info">
                      <div className="stat-value">{s.value}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tableau */}
              <div className="card">
                <div className="card-header">
                  <div>
                    <span className="card-title">Dernières inscriptions</span>
                    <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Activité récente du centre</p>
                  </div>
                  <span className="badge badge-info">{inscriptions.length} enregistrement{inscriptions.length > 1 ? 's' : ''}</span>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>#</th><th>Matricule</th><th>Étudiant</th><th>Session</th><th>Date</th><th>Montant</th><th>Reste</th></tr>
                    </thead>
                    <tbody>
                      {inscriptions.length === 0 ? (
                        <tr><td colSpan={7} style={{ padding: 0 }}>
                          <EmptyInscriptions onNavigate={() => navigate('/etudiant/etudiant')} />
                        </td></tr>
                      ) : inscriptions.map((i, idx) => (
                        <tr key={i.id_paiement}>
                          <td style={{ color: '#94a3b8', fontSize: 12 }}>{idx + 1}</td>
                          <td><span className="badge badge-info">{i.matricule}</span></td>
                          <td style={{ fontWeight: 600, color: '#1e293b' }}>{i.nom_complet}</td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{i.code_session}</td>
                          <td style={{ fontSize: 12 }}>{i.date_paiement}</td>
                          <td style={{ fontWeight: 700, color: '#16a34a' }}>{fmt(Number(i.montant_paye))} Ar</td>
                          <td><span className={`badge ${Number(i.reste) === 0 ? 'badge-success' : 'badge-danger'}`}>{fmt(Number(i.reste))} Ar</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}