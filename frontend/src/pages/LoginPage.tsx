import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import Logo from '../assets/logo.png'
import { IconMail, IconLock, IconEye, IconEyeOff } from '.././components/icons'



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
      toast.error(err.response?.data?.message || 'Identifiants incorrects')
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

            {/* Mot de passe oublié */}
            <div className="auth-forgot">
              <Link to="/forgot-password">Mot de passe oublié ?</Link>
            </div>

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