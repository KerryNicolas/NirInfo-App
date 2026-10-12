import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import CreateUserForm from '../components/CreateUserForm'
import { IconUser } from '.././components/icons'

// Le formulaire lui-même vit dans components/CreateUserForm.tsx, partagé avec
// la fenêtre des paramètres. Cette page ne garde que la garde admin et le cadre.
export default function CreateUserPage() {
  const { isAdmin } = useAuth()

  // FIX : page réservée admin — protection double (routeur + ce garde-fou local)
  if (!isAdmin()) return <Navigate to="/dashboard" replace />

  return (
    <div style={{ maxWidth: 480, margin: '40px auto' }}>
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <IconUser /> Créer un compte utilisateur
          </span>
        </div>
        <div className="card-body">
          <CreateUserForm />
        </div>
      </div>
    </div>
  )
}
