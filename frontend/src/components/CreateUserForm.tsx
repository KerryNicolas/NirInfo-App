import { useEffect, useState } from 'react'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { IconUser, IconMail } from './icons'

interface Role { id: number; name: string; slug: string }

// Formulaire de création de compte, partagé par la page /admin/create-user et
// par la fenêtre des paramètres : un seul formulaire, un seul appel API.
// Pas de mot de passe ici : le serveur envoie un lien d'activation par
// e-mail, et c'est l'utilisateur qui choisit son mot de passe.
export default function CreateUserForm({ onCreated }: { onCreated?: () => void }) {
  const [roles, setRoles]     = useState<Role[]>([])
  // FIX : "Nom complet" scindé en Nom + Prénom séparés — nécessaire pour
  // créer automatiquement la ligne `salarie` correspondante côté backend
  // (nom_s/prenom_s), qui elle-même résout le champ "Éditeur" vide partout
  // dans l'appli pour tout nouveau compte.
  const [nom, setNom]         = useState('')
  const [prenom, setPrenom]   = useState('')
  const [email, setEmail]     = useState('')
  const [roleId, setRoleId]   = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/roles').then(r => setRoles(r.data)).catch(() => setRoles([]))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    try {
      await api.post('/users', { nom, prenom, email, role_id: roleId })
      toast.success("Compte créé avec succès. Un e-mail d’activation a été envoyé à l’utilisateur.")
      setNom(''); setPrenom(''); setEmail(''); setRoleId('')
      onCreated?.()
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
    <form onSubmit={handleSubmit}>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Nom</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
              <IconUser />
            </span>
            <input className="form-control" style={{ paddingLeft: 34 }}
              value={nom} onChange={e => setNom(e.target.value)}
              required placeholder="Nom de famille" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Prénom</label>
          <input className="form-control"
            value={prenom} onChange={e => setPrenom(e.target.value)}
            required placeholder="Prénom" />
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

      <button type="submit" className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', gap: 7, marginTop: 4 }}
        disabled={loading}>
        {loading
          ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Création…</>
          : 'Créer le compte'
        }
      </button>
    </form>
  )
}
