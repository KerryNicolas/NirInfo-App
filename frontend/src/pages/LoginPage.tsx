import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import Logo from '../assets/logo.png'
import { IconMail, IconLock, IconEye, IconEyeOff } from '.././components/icons'

// FIX : toutes les notifications de connexion sont en français, quel que soit
// le message renvoyé par le serveur. On choisit le texte d'après le code HTTP
// au lieu d'afficher tel quel un message Laravel qui peut être en anglais
// (ex. "Too Many Attempts." renvoyé par le throttle de la route /login).
function loginErrorMessage(err: any): string {
  // Aucune réponse : serveur arrêté, coupure réseau, CORS…
  if (!err?.response) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion.'
  }

  const status = err.response.status
  const data   = err.response.data || {}

  if (status === 429) {
    // Verrouillage de AuthController::login : message déjà en français, avec
    // le temps restant (reconnaissable à la présence de "retry_after").
    if (data.retry_after && data.message) return data.message
    // Throttle de la route (6 requêtes/minute) : message Laravel en anglais.
    return 'Trop de tentatives. Patientez une minute avant de réessayer.'
  }

  if (status === 422) {
    // Messages de validation définis en français dans AuthController::login.
    const errors = data.errors || {}
    return errors.email?.[0] || errors.password?.[0] || 'Les identifiants sont incorrects.'
  }

  if (status === 419) {
    return 'Session expirée. Rechargez la page puis réessayez.'
  }

  if (status >= 500) {
    return 'Erreur du serveur. Réessayez dans quelques instants.'
  }

  return 'Connexion impossible. Réessayez.'
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Connexion réussie !')
      navigate('/dashboard')
    } catch (err: any) {
      toast.error(loginErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>

      <div className="auth-page">

        {/* Logo + nom */}
        <div className="auth-logo">
          <img src={Logo} alt="Logo" width={304} height={34} />
        </div>

        {/* Card connexion */}
        <div className="auth-container">
          <h1>Connexion</h1>

          <form onSubmit={handleSubmit}>

            {/* Email */}
            <div className="auth-input-box">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <span className="auth-input-icon"><IconMail /></span>
            </div>

            {/* Mot de passe */}
            <div className="auth-input-box">
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="Mot de passe"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: 46 }}
              />
              <button type="button" className="auth-eye-btn" onClick={() => setShowPwd(!showPwd)}>
                {showPwd ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>

            {/* Mot de passe oublié — DÉSACTIVÉ jusqu'à nouvel ordre.
                Décommenter le bloc ci-dessous (et remettre l'import de Link
                en haut du fichier) pour le réactiver. */}
            {/*
            <div className="auth-forgot">
              <Link to="/forgot-password">Mot de passe oublié ?</Link>
            </div>
            */}

            {/* Bouton connexion */}
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading
                ? <><span className="spinner" /> Connexion…</>
                : 'Se connecter'
              }
            </button>

            <div className="auth-divider">accès réservé au personnel</div>

          </form>
        </div>

        {/* Copyright */}
        <div className="auth-copyright">
          Nir'Info © {new Date().getFullYear()}
        </div>

      </div>
    </>
  )
}