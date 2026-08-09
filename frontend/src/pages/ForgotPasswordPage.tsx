import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { IconMail, IconArrowLeft, IconSend, IconCheckCircle } from '.././components/icons'

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth()
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await forgotPassword(email)
      setSent(true)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Email introuvable dans le système')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#111C3D',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: 'white', borderRadius: 20,
        padding: '40px 36px', width: '100%', maxWidth: 420,
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
      }}>

        {/* Retour */}
        <Link to="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#64748b', textDecoration: 'none', fontSize: 13,
          fontWeight: 500, marginBottom: 28,
          transition: 'color 0.15s',
        }}>
          <IconArrowLeft /> Retour à la connexion
        </Link>

        {!sent ? (
          <>
            {/* Icône */}
            <div style={{
              width: 52, height: 52, background: '#eff6ff',
              border: '1px solid #bfdbfe', borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#2563eb', marginBottom: 20,
            }}>
              <IconMail />
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 8, letterSpacing: '-0.01em' }}>
              Mot de passe oublié ?
            </h2>
            <p style={{ color: '#64748b', fontSize: 13.5, lineHeight: 1.6, marginBottom: 28 }}>
              Entrez l'adresse email associée à votre compte. Nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Adresse email</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 11, top: '50%',
                    transform: 'translateY(-50%)', color: '#94a3b8',
                    display: 'flex', pointerEvents: 'none',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                  </span>
                  <input
                    className="form-control"
                    style={{ paddingLeft: 36 }}
                    type="email"
                    placeholder="votre@email.mg"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: 14, marginTop: 4, gap: 8 }}
                disabled={loading}
              >
                {loading
                  ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Envoi en cours…</>
                  : <> Envoyer le lien <IconSend /></>
                }
              </button>
            </form>
          </>
        ) : (
          /* ── État : email envoyé ── */
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ color: '#16a34a', marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
              <IconCheckCircle />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
              Email envoyé !
            </h3>
            <p style={{ color: '#64748b', fontSize: 13.5, lineHeight: 1.65, marginBottom: 8 }}>
              Un lien de réinitialisation a été envoyé à
            </p>
            <p style={{
              color: '#2563eb', fontWeight: 700, fontSize: 14,
              background: '#eff6ff', padding: '8px 16px',
              borderRadius: 8, display: 'inline-block', marginBottom: 24,
            }}>
              {email}
            </p>
            <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, marginBottom: 28 }}>
              Vérifiez votre boîte mail et suivez les instructions. Le lien expire dans <strong>60 minutes</strong>.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              style={{
                background: 'none', border: '1px solid #e2e8f0',
                borderRadius: 8, padding: '9px 20px',
                fontSize: 13, color: '#64748b', cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Utiliser un autre email
            </button>
          </div>
        )}
      </div>
    </div>
  )
}