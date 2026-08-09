import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { IconEyeOff, IconEye, IconUser, IconMail, IconLock } from '.././components/icons'

interface Role { id: number; name: string; slug: string }

export default function CreateUserPage() {
  const { isAdmin } = useAuth()

  const [roles, setRoles]       = useState<Role[]>([])
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [roleId, setRoleId]     = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    api.get('/roles').then(r => setRoles(r.data)).catch(() => setRoles([]))
  }, [])

  // FIX : page réservée admin — protection double (routeur + ce garde-fou local)
  if (!isAdmin()) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      await api.post('/users', {
        name, email, role_id: roleId,
        password, password_confirmation: confirm,
      })
      toast.success(`Compte créé avec succès pour ${name}`)
      setName(''); setEmail(''); setRoleId(''); setPassword(''); setConfirm('')
    } catch (err: any) {
      const message = err.response?.data?.message
      const errors  = err.response?.data?.errors || {}
      if (errors.email) toast.error('Cette adresse email est déjà utilisée')
      else toast.error(message || 'Erreur lors de la création du compte')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto' }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <IconUser /> Créer un compte utilisateur
          </span>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>

            <div className="form-group">
              <label className="form-label">Nom complet</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                  <IconUser />
                </span>
                <input className="form-control" style={{ paddingLeft: 34 }}
                  value={name} onChange={e => setName(e.target.value)}
                  required placeholder="Prénom et nom" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Adresse email</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                  <IconMail />
                </span>
                <input className="form-control" style={{ paddingLeft: 34 }} type="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  required placeholder="nom@nir-info.mg" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Rôle</label>
              <select className="form-control" value={roleId} onChange={e => setRoleId(e.target.value)} required>
                <option value="">-- Choisir un rôle --</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
                  <IconLock />
                </span>
                <input className="form-control" style={{ paddingLeft: 34, paddingRight: 40 }}
                  type={showPwd ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={8} placeholder="Minimum 8 caractères" />
                <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', padding: 4,
                }}>
                  {showPwd ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirmer le mot de passe</label>
              <input className="form-control" type="password"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                required placeholder="Répéter le mot de passe" />
              {confirm && password !== confirm && (
                <p style={{ color: '#ef4444', fontSize: 12, marginTop: 5 }}>
                  Les mots de passe ne correspondent pas
                </p>
              )}
            </div>

            <button type="submit" className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', gap: 7, marginTop: 4 }}
              disabled={loading}>
              {loading
                ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Création…</>
                : 'Créer le compte'
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}