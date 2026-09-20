import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { IconEyeOff, IconEye, IconUser, IconMail, IconPhone, IconSave, IconLock, IcoUsers } from '.././components/icons'

// FIX : flèche retour — même dessin que celui utilisé dans Sidebar.tsx pour
// rester cohérent visuellement.
function SvgArrowLeft() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}



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
  const { user, updateProfile, isAdmin } = useAuth()
  const navigate = useNavigate()

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
    // FIX : corps de la page décalé de 50px vers le bas (marginTop)
    <div style={{ maxWidth: 760, margin: '0 auto', marginTop: 50 }}>

      {/* FIX : bouton retour, cohérent avec la flèche du menu latéral */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#2563eb', fontSize: 13, fontWeight: 600, padding: 0,
        }}
      >
        <SvgArrowLeft /> Retour
      </button>

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

          {/* FIX : bouton "Créer un utilisateur" positionné dans la zone haute-droite,
              exactement comme demandé — visible uniquement pour l'admin */}
          {isAdmin() && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
              onClick={() => navigate('/admin/create-user')}
            >
              <IcoUsers /> Créer un utilisateur
            </button>
          )}

          {user?.matricule && (
            <div style={{ marginLeft: isAdmin() ? 16 : 'auto', textAlign: 'right' }}>
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

              <div/>

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