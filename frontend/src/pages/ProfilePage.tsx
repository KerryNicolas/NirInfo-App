import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

const IconLock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

const IconMail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
)

const IconPhone = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
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

const IconSave = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
    <polyline points="17 21 17 13 7 13 7 21"/>
    <polyline points="7 3 7 8 15 8"/>
  </svg>
)

function PwdInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="form-control"
          style={{ paddingRight: 40 }}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
        <button type="button" onClick={() => setShow(!show)} style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#94a3b8', display: 'flex', padding: 4,
        }}>
          {show ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user, updateProfile } = useAuth()

  // Infos personnelles
  const [name, setName]   = useState(user?.name  || '')
  const [email, setEmail] = useState(user?.email || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [loadingInfo, setLoadingInfo] = useState(false)

  // Mot de passe
  const [currentPwd, setCurrentPwd] = useState('')
  const [newPwd, setNewPwd]         = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [loadingPwd, setLoadingPwd] = useState(false)

  /* ── Initiales avatar ── */
  const initials = (user?.name || 'U')
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  /* ── Sauvegarder infos ── */
  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoadingInfo(true)
    try {
      await updateProfile({ name, email, phone })
      toast.success('Informations mises à jour')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erreur lors de la mise à jour')
    } finally {
      setLoadingInfo(false)
    }
  }

  /* ── Changer mot de passe ── */
  const handlePwdSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPwd !== confirmPwd) { toast.error('Les mots de passe ne correspondent pas'); return }
    if (newPwd.length < 8)     { toast.error('Minimum 8 caractères requis'); return }
    setLoadingPwd(true)
    try {
      await updateProfile({
        current_password: currentPwd,
        password: newPwd,
        password_confirmation: confirmPwd,
      })
      toast.success('Mot de passe modifié avec succès')
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Mot de passe actuel incorrect')
    } finally {
      setLoadingPwd(false)
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* ── En-tête profil ── */}
      <div className="card" style={{ marginBottom: 20, padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 68, height: 68, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #1e3a8a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 22, fontWeight: 700, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
              {user?.name}
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 6 }}>{user?.email}</p>
            <span style={{
              display: 'inline-block', padding: '2px 10px',
              background: user?.role === 'admin' ? '#eff6ff' : '#f0fdf4',
              color:      user?.role === 'admin' ? '#1d4ed8' : '#15803d',
              border: `1px solid ${user?.role === 'admin' ? '#bfdbfe' : '#bbf7d0'}`,
              borderRadius: 20, fontSize: 11.5, fontWeight: 600,
            }}>
              {user?.role === 'admin' ? 'Administrateur' : 'Gestionnaire'}
            </span>
          </div>
          {user?.matricule && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Matricule</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#1e3a8a' }}>{user.matricule}</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* ── Informations personnelles ── */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb' }}>
              <IconUser />
              <span className="card-title">Informations personnelles</span>
            </div>
          </div>
          <div className="card-body">
            <form onSubmit={handleInfoSubmit}>

              <div className="form-group">
                <label className="form-label">Nom complet</label>
                <input
                  className="form-control"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Votre nom"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Adresse email</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 11, top: '50%',
                    transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex',
                    pointerEvents: 'none',
                  }}>
                    <IconMail />
                  </span>
                  <input
                    className="form-control"
                    style={{ paddingLeft: 34 }}
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.mg"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 11, top: '50%',
                    transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex',
                    pointerEvents: 'none',
                  }}>
                    <IconPhone />
                  </span>
                  <input
                    className="form-control"
                    style={{ paddingLeft: 34 }}
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+261 34 000 0000"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', gap: 7, marginTop: 4 }}
                disabled={loadingInfo}
              >
                {loadingInfo
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Enregistrement…</>
                  : <><IconSave /> Enregistrer</>
                }
              </button>
            </form>
          </div>
        </div>

        {/* ── Changer mot de passe ── */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2563eb' }}>
              <IconLock />
              <span className="card-title">Sécurité du compte</span>
            </div>
          </div>
          <div className="card-body">
            <form onSubmit={handlePwdSubmit}>

              <PwdInput
                label="Mot de passe actuel"
                value={currentPwd}
                onChange={setCurrentPwd}
                placeholder="Votre mot de passe actuel"
              />

              <div style={{
                height: 1, background: '#f1f5f9',
                margin: '4px 0 16px',
              }} />

              <PwdInput
                label="Nouveau mot de passe"
                value={newPwd}
                onChange={setNewPwd}
                placeholder="Minimum 8 caractères"
              />

              <PwdInput
                label="Confirmer le nouveau mot de passe"
                value={confirmPwd}
                onChange={setConfirmPwd}
                placeholder="Répéter le mot de passe"
              />

              {confirmPwd && newPwd !== confirmPwd && (
                <p style={{ color: '#ef4444', fontSize: 12, marginTop: -8, marginBottom: 10 }}>
                  Les mots de passe ne correspondent pas
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', gap: 7, marginTop: 4 }}
                disabled={loadingPwd || !currentPwd || !newPwd || newPwd !== confirmPwd}
              >
                {loadingPwd
                  ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Mise à jour…</>
                  : <><IconSave /> Changer le mot de passe</>
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}