import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const IconUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

const IconMail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
)

const IconLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const IconAlertCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate     = useNavigate()

  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)

  // Erreur email dupliqué
  const [emailError, setEmailError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError('')

    if (password !== confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)
    try {
      await register(name, email, password, confirm)
      toast.success('Compte créé avec succès !')
      navigate('/dashboard')
    } catch (err: any) {
      const status  = err.response?.status
      const message = err.response?.data?.message || ''
      const errors  = err.response?.data?.errors  || {}

      // Email déjà utilisé → alerte spécifique sous le champ email
      if (status === 422 && (errors.email || message.includes('email'))) {
        setEmailError('Cette adresse email est déjà associée à un compte.')
        toast.error('Email déjà utilisé', { icon: '⚠️' })
      } else {
        toast.error(message || 'Erreur lors de la création du compte')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #0a0f1e 0%, #0f172a 40%, #1e3a8a 80%, #1d4ed8 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'white', borderRadius: 20,
        padding: '36px 32px', width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 38, height: 38, background: '#1e40af', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>Nir'Info</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Créer un compte</div>
          </div>
        </div>

        <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
          Demander un accès
        </h3>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
          Remplissez le formulaire ci-dessous. Votre compte sera validé par un administrateur.
        </p>

        <form onSubmit={handleSubmit}>

          {/* Nom */}
          <div className="form-group">
            <label className="form-label">Nom complet</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                <IconUser />
              </span>
              <input className="form-control" style={{ paddingLeft: 34 }}
                type="text" placeholder="Prénom et nom"
                value={name} onChange={e => setName(e.target.value)} required />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label">Adresse email</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: emailError ? '#ef4444' : '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                <IconMail />
              </span>
              <input
                className="form-control"
                style={{
                  paddingLeft: 34,
                  borderColor: emailError ? '#ef4444' : undefined,
                  boxShadow: emailError ? '0 0 0 3px rgba(239,68,68,0.1)' : undefined,
                }}
                type="email" placeholder="votre@email.mg"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError('') }}
                required
              />
            </div>
            {/* Alerte email déjà utilisé */}
            {emailError && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 7,
                marginTop: 7, padding: '8px 12px',
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 8, color: '#b91c1c', fontSize: 12.5, lineHeight: 1.5,
              }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}><IconAlertCircle /></span>
                <span>
                  {emailError}{' '}
                  <Link to="/login" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                    Se connecter ?
                  </Link>
                  {' '}ou{' '}
                  <Link to="/forgot-password" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
                    Mot de passe oublié ?
                  </Link>
                </span>
              </div>
            )}
          </div>

          {/* Mot de passe */}
          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                <IconLock />
              </span>
              <input className="form-control" style={{ paddingLeft: 34, paddingRight: 42 }}
                type={showPwd ? 'text' : 'password'} placeholder="Minimum 6 caractères"
                value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 4,
              }}>
                {showPwd ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          {/* Confirmation */}
          <div className="form-group">
            <label className="form-label">Confirmer le mot de passe</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                <IconLock />
              </span>
              <input className="form-control" style={{ paddingLeft: 34 }}
                type="password" placeholder="Répéter le mot de passe"
                value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            {confirm && password !== confirm && (
              <p style={{ color: '#ef4444', fontSize: 12, marginTop: 5 }}>Les mots de passe ne correspondent pas</p>
            )}
          </div>

          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 4 }}
            disabled={loading}>
            {loading
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Création…</>
              : 'Créer mon compte'
            }
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
          Déjà un compte ?{' '}
          <Link to="/login" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}