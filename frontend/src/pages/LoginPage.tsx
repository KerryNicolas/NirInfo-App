import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

/* ── Icônes SVG inline professionnelles ── */
const IconGraduate = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
)

const IconMail = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
)

const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
)

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const IconBook = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)

const IconChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
    <line x1="2"  y1="20" x2="22" y2="20"/>
  </svg>
)

/* ── Composant principal ── */
export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Connexion réussie !')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Identifiants incorrects')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: <IconUsers />, title: 'Gestion des étudiants',    sub: 'Inscriptions, paiements et suivi en temps réel' },
    { icon: <IconBook />,  title: 'Catalogue de formations',  sub: 'Modules, sessions et horaires centralisés'      },
    { icon: <IconChart />, title: 'Rapports & statistiques',  sub: 'États financiers, recouvrements et certificats' },
  ]

  return (
    <div className="auth-layout">

      {/* ── Panneau gauche ── */}
      <div className="auth-left">
        <div style={{ position: 'relative', zIndex: 1 }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
            <div style={{
              width: 48, height: 48,
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white',
            }}>
              <IconGraduate />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: '0.02em' }}>Nir'Info</div>
              <div style={{ fontSize: 11.5, opacity: 0.65, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Centre de Formation
              </div>
            </div>
          </div>

          {/* Titre */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 20, padding: '4px 14px',
            fontSize: 12, marginBottom: 20, color: 'rgba(255,255,255,0.85)'
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', display: 'inline-block' }} />
            Plateforme active
          </div>

          <h2 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.15, marginBottom: 16, letterSpacing: '-0.02em' }}>
            Gérez votre centre<br />
            <span style={{ color: '#93c5fd' }}>avec excellence</span>
          </h2>
          <p style={{ opacity: 0.7, lineHeight: 1.7, marginBottom: 44, fontSize: 14, maxWidth: 360 }}>
            Une solution complète pour piloter vos formations, suivre vos étudiants et optimiser vos revenus.
          </p>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {features.map(f => (
              <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{
                  width: 40, height: 40,
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#93c5fd', flexShrink: 0,
                }}>
                  {f.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 3 }}>{f.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.5 }}>{f.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer gauche */}
          <div style={{
            marginTop: 52, paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: 11.5, opacity: 0.5,
            display: 'flex', gap: 16
          }}>
            <span>© 2026 Nir'Info</span>
            <span>·</span>
            <span>v2.0</span>
          </div>
        </div>
      </div>

      {/* ── Panneau droit ── */}
      <div className="auth-right">
        <div className="auth-form-box">

          {/* En-tête formulaire */}
          <div style={{ marginBottom: 28 }}>
            <div style={{
              width: 44, height: 44,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#2563eb', marginBottom: 16,
            }}>
              <IconLock />
            </div>
            <h3 style={{ fontSize: 21, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
              Connexion administrateur
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>
              Accédez à votre tableau de bord de gestion
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit}>

            {/* Email */}
            <div className="form-group">
              <label className="form-label">Adresse email</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 11, top: '50%',
                  transform: 'translateY(-50%)', color: '#94a3b8',
                  display: 'flex', pointerEvents: 'none',
                }}>
                  <IconMail />
                </span>
                <input
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  type="email"
                  placeholder="admin@nirinfo.mg"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Mot de passe</label>
              <Link 
                to="/forgot-password" style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                Mot de passe oublié ?
              </Link>
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 11, top: '50%',
                  transform: 'translateY(-50%)', color: '#94a3b8',
                  display: 'flex', pointerEvents: 'none',
                }}>
                  <IconLock />
                </span>
                <input
                  className="form-control"
                  style={{ paddingLeft: 36, paddingRight: 42 }}
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94a3b8', display: 'flex', padding: 4,
                    borderRadius: 4, transition: 'color 0.15s',
                  }}
                >
                  {showPwd ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            {/* Bouton connexion */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%', justifyContent: 'center',
                padding: '11px 16px', fontSize: 14, marginTop: 6,
                gap: 8,
              }}
              disabled={loading}
            >
              {loading
                ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Connexion en cours…</>
                : <> Se connecter <IconArrow /></>
              }
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            margin: '22px 0', color: '#cbd5e1', fontSize: 12,
          }}>
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
            accès réservé au personnel
            <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          </div>

          {/* Lien inscription */}
          <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b' }}>
            Pas encore de compte ?{' '}
            <Link to="/register" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
              Demander un accès
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}