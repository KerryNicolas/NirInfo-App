import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/axios'
import toast from 'react-hot-toast'

interface Stats {
  total_etudiants: number
  sessions_actives: number
  inscriptions_mois: number
  revenus_mois: number
}
interface Inscription {
  id_paiement: number
  matricule: string
  nom_complet: string
  code_session: string
  date_paiement: string
  montant_paye: number
  reste: number
}

export default function DashboardMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [inscriptions, setInscriptions] = useState<Inscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(r => {
        setStats(r.data.stats)
        setInscriptions(r.data.dernieres_inscriptions)
      })
      .catch(() => toast.error('Erreur chargement données'))
      .finally(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const fmt = (n: number) => new Intl.NumberFormat('fr-MG').format(n)

  return (
    <div style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* Top bar */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#2563eb', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 16 }}>🎓</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Nir'Info</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 13, color: '#64748b' }}>Bonjour, <b>{user?.name}</b></span>
          <button onClick={handleLogout} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, padding: 28, maxWidth: 1200, margin: '0 auto' }}>
        {/* Left: Menu card (page 3 style) */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <div className="menu-card">
            <h2>Menu principal</h2>
            <div className="menu-btn-list">
              {[
                { label: 'Formations',        to: '/formation' },
                { label: 'Logistiques',       to: '#' },
                { label: 'Personnel',         to: '#' },
                { label: 'Services',          to: '#' },
                { label: 'Gestion du budget', to: '#' },
              ].map(m => (
                <Link key={m.label} to={m.to} className="menu-btn">{m.label}</Link>
              ))}
            </div>
            <div className="menu-footer">
              <button>⚙ Paramètres</button>
              <button onClick={handleLogout}>⏻ Déconnexion</button>
            </div>
          </div>
        </div>

        {/* Right: stats + table */}
        <div style={{ flex: 1 }}>
          {loading ? (
            <div className="loading-center"><div className="spinner" />Chargement…</div>
          ) : (
            <>
              {/* Stats */}
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 22 }}>
                {[
                  { label: 'Total Étudiants',    value: fmt(stats?.total_etudiants ?? 0),    icon: '👥', cls: 'blue' },
                  { label: 'Sessions actives',   value: fmt(stats?.sessions_actives ?? 0),   icon: '📚', cls: 'green' },
                  { label: 'Inscriptions/mois',  value: fmt(stats?.inscriptions_mois ?? 0),  icon: '📝', cls: 'orange' },
                  { label: 'Revenus du mois',    value: fmt(stats?.revenus_mois ?? 0) + ' Ar', icon: '💰', cls: 'purple' },
                ].map(s => (
                  <div key={s.label} className="stat-card">
                    <div className={`stat-icon ${s.cls}`} style={{ fontSize: 22 }}>{s.icon}</div>
                    <div className="stat-info">
                      <div className="stat-value">{s.value}</div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dernières inscriptions ORDER BY DESC */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Dernières inscriptions</span>
                  <span className="badge badge-info">{inscriptions.length} enregistrements</span>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Matricule</th>
                        <th>Étudiant</th>
                        <th>Session</th>
                        <th>Date</th>
                        <th>Montant</th>
                        <th>Reste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inscriptions.length === 0 ? (
                        <tr><td colSpan={7} className="text-center" style={{ padding: 30, color: '#94a3b8' }}>Aucune donnée</td></tr>
                      ) : inscriptions.map(i => (
                        <tr key={i.id_paiement}>
                          <td style={{ color: '#94a3b8', fontSize: 12 }}>{i.id_paiement}</td>
                          <td><span className="badge badge-info">{i.matricule}</span></td>
                          <td style={{ fontWeight: 500 }}>{i.nom_complet}</td>
                          <td style={{ fontSize: 12, color: '#64748b' }}>{i.code_session}</td>
                          <td style={{ fontSize: 12 }}>{i.date_paiement}</td>
                          <td style={{ fontWeight: 600, color: '#16a34a' }}>{fmt(Number(i.montant_paye))} Ar</td>
                          <td>
                            <span className={`badge ${Number(i.reste) === 0 ? 'badge-success' : 'badge-danger'}`}>
                              {fmt(Number(i.reste))} Ar
                            </span>
                          </td>
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
