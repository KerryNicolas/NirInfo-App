import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const IconLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const IconEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const IconEyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
)

function PasswordInput({ value, onChange, placeholder }: {
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const [show, setShow] = useState(false)
  return (
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
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        minLength={8}
      />
      <button type="button" onClick={() => setShow(!show)} style={{
        position: 'absolute', right: 10, top: '50%',
        transform: 'translateY(-50%)', background: 'none',
        border: 'none', cursor: 'pointer', color: '#94a3b8',
        display: 'flex', padding: 4,
      }}>
        {show ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  )
}

function StrengthBar({ password }: { password: string }) {
  const checks = [
    { label: '8 caractères minimum', ok: password.length >= 8 },
    { label: 'Une lettre majuscule',  ok: /[A-Z]/.test(password) },
    { label: 'Un chiffre',            ok: /[0-9]/.test(password) },
    { label: 'Un caractère spécial',  ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const colors = ['#e2e8f0', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e']
  const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort']

  if (!password) return null

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= score ? colors[score] : '#e2e8f0',
            transition: 'background 0.3s',
          }} />
        ))}
        <span style={{ fontSize: 11, color: colors[score], fontWeight: 600, marginLeft: 6, whiteSpace: 'nowrap' }}>
          {labels[score]}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
        {checks.map(c => (
          <span key={c.label} style={{
            fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4,
            color: c.ok ? '#16a34a' : '#94a3b8',
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              background: c.ok ? '#dcfce7' : '#f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: c.ok ? '#16a34a' : '#cbd5e1', flexShrink: 0,
            }}>
              {c.ok && <IconCheck />}
            </span>
            {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const navigate           = useNavigate()
  const [searchParams]     = useSearchParams()

  const token = searchParams.get('token') || ''
  const email = searchParams.get('email') || ''

  const [password, setPassword]         = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading]           = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmation) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    if (password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    setLoading(true)
    try {
      await resetPassword({ token, email, password, password_confirmation: confirmation })
      toast.success('Mot de passe réinitialisé avec succès !')
      navigate('/login')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lien invalide ou expiré')
    } finally {
      setLoading(false)
    }
  }

  if (!token || !email) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc',
      }}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#ef4444', fontSize: 16, marginBottom: 16 }}>
            Lien de réinitialisation invalide.
          </p>
          <Link to="/forgot-password" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #0a0f1e 0%, #0f172a 40%, #1e3a8a 80%, #1d4ed8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 20,
        padding: '40px 36px', width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>

        {/* Icône */}
        <div style={{
          width: 52, height: 52, background: '#eff6ff',
          border: '1px solid #bfdbfe', borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#2563eb', marginBottom: 20,
        }}>
          <IconLock />
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8, letterSpacing: '-0.01em' }}>
          Nouveau mot de passe
        </h2>
        <p style={{ color: '#64748b', fontSize: 13.5, lineHeight: 1.6, marginBottom: 6 }}>
          Réinitialisation pour le compte :
        </p>
        <p style={{
          color: '#2563eb', fontWeight: 600, fontSize: 13,
          background: '#eff6ff', padding: '6px 12px',
          borderRadius: 7, display: 'inline-block', marginBottom: 24,
        }}>
          {email}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nouveau mot de passe</label>
            <PasswordInput value={password} onChange={setPassword} placeholder="Minimum 8 caractères" />
            <StrengthBar password={password} />
          </div>

          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Confirmer le mot de passe</label>
            <PasswordInput value={confirmation} onChange={setConfirmation} placeholder="Répéter le mot de passe" />
            {confirmation && password !== confirmation && (
              <p style={{ color: '#ef4444', fontSize: 12, marginTop: 5 }}>
                Les mots de passe ne correspondent pas
              </p>
            )}
            {confirmation && password === confirmation && confirmation.length > 0 && (
              <p style={{ color: '#16a34a', fontSize: 12, marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconCheck /> Mots de passe identiques
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 8, gap: 8 }}
            disabled={loading || password !== confirmation || password.length < 8}
          >
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Mise à jour…</>
              : 'Réinitialiser le mot de passe'
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12.5, color: '#94a3b8' }}>
          Lien invalide ?{' '}
          <Link to="/forgot-password" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
            En demander un nouveau
          </Link>
        </p>
      </div>
    </div>
  )
}