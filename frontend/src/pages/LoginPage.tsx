// import { useState } from 'react'
// import { Link, useNavigate } from 'react-router-dom'
// import { useAuth } from '../contexts/AuthContext'
// import toast from 'react-hot-toast'

// const IconGraduate = () => (
//   <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
//     <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
//     <path d="M6 12v5c3 3 9 3 12 0v-5"/>
//   </svg>
// )
// const IconMail = () => (
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//     <rect x="2" y="4" width="20" height="16" rx="2"/>
//     <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
//   </svg>
// )
// const IconLock = () => (
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//     <rect x="3" y="11" width="18" height="11" rx="2"/>
//     <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
//   </svg>
// )
// /* Un seul œil — le plus populaire : œil barré quand caché, œil ouvert quand visible */
// const IconEyeOff = () => (
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//     <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
//     <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
//     <line x1="1" y1="1" x2="23" y2="23"/>
//   </svg>
// )
// const IconEye = () => (
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//     <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
//     <circle cx="12" cy="12" r="3"/>
//   </svg>
// )
// const IconArrow = () => (
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//     <path d="M5 12h14M12 5l7 7-7 7"/>
//   </svg>
// )
// const IconUsers = () => (
//   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
//     <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
//     <circle cx="9" cy="7" r="4"/>
//     <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
//   </svg>
// )
// const IconBook = () => (
//   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
//     <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
//     <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
//   </svg>
// )
// const IconChart = () => (
//   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
//     <line x1="18" y1="20" x2="18" y2="10"/>
//     <line x1="12" y1="20" x2="12" y2="4"/>
//     <line x1="6"  y1="20" x2="6"  y2="14"/>
//     <line x1="2"  y1="20" x2="22" y2="20"/>
//   </svg>
// )

// /* Suggestions d'emails connues — en pratique viendrait de l'API ou localStorage */
// const EMAIL_SUGGESTIONS = [
//   'admin@nirinfo.mg',
//   'gestionnaire@nirinfo.mg',
// ]

// export default function LoginPage() {
//   const { login } = useAuth()
//   const navigate  = useNavigate()
//   const [email, setEmail]         = useState('')
//   const [password, setPassword]   = useState('')
//   const [showPwd, setShowPwd]     = useState(false)
//   const [loading, setLoading]     = useState(false)
//   const [suggestions, setSuggestions] = useState<string[]>([])
//   const [showSugg, setShowSugg]   = useState(false)

//   /* ── Autosuggestion email ── */
//   const handleEmailChange = (val: string) => {
//     setEmail(val)
//     if (val.length > 0) {
//       const filtered = EMAIL_SUGGESTIONS.filter(s =>
//         s.toLowerCase().startsWith(val.toLowerCase())
//       )
//       setSuggestions(filtered)
//       setShowSugg(filtered.length > 0)
//     } else {
//       setShowSugg(false)
//     }
//   }

//   const selectSuggestion = (s: string) => {
//     setEmail(s)
//     setShowSugg(false)
//   }

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setShowSugg(false)
//     setLoading(true)
//     try {
//       await login(email, password)
//       toast.success('Connexion réussie !')
//       navigate('/dashboard')
//     } catch (err: any) {
//       toast.error(err.response?.data?.message || 'Identifiants incorrects')
//     } finally {
//       setLoading(false)
//     }
//   }

//   const features = [
//     { icon: <IconUsers />, title: 'Gestion des étudiants',   sub: 'Inscriptions, paiements et suivi en temps réel' },
//     { icon: <IconBook />,  title: 'Catalogue de formations', sub: 'Modules, sessions et horaires centralisés'      },
//     { icon: <IconChart />, title: 'Rapports & statistiques', sub: 'États financiers, recouvrements et certificats' },
//   ]

//   return (
//     <div className="auth-layout">

//       {/* ── Panneau droit ── */}
//       <div className="auth-right">
//         <div className="auth-form-box">
//           <div style={{ marginBottom: 28 }}>
//             <div style={{ width: 44, height: 44, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', marginBottom: 16 }}>
//               <IconLock />
//             </div>
//             <h3 style={{ fontSize: 21, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Connexion administrateur</h3>
//             <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5 }}>Accédez à votre tableau de bord de gestion</p>
//           </div>

//           <form onSubmit={handleSubmit}>

//             {/* ── Email avec autosuggestion ── */}
//             <div className="form-group">
//               <label className="form-label">Adresse email</label>
//               <div style={{ position: 'relative' }}>
//                 <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
//                   <IconMail />
//                 </span>
//                 <input
//                   className="form-control"
//                   style={{ paddingLeft: 36 }}
//                   type="email"
//                   placeholder="admin@nirinfo.mg"
//                   value={email}
//                   onChange={e => handleEmailChange(e.target.value)}
//                   onFocus={() => email.length > 0 && suggestions.length > 0 && setShowSugg(true)}
//                   onBlur={() => setTimeout(() => setShowSugg(false), 150)}
//                   required
//                   autoComplete="email"
//                 />
//                 {/* Dropdown suggestions */}
//                 {showSugg && (
//                   <div style={{
//                     position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
//                     background: 'white', border: '1px solid #e2e8f0',
//                     borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
//                     marginTop: 4, overflow: 'hidden',
//                   }}>
//                     {suggestions.map(s => (
//                       <button key={s} type="button"
//                         onMouseDown={() => selectSuggestion(s)}
//                         style={{
//                           display: 'flex', alignItems: 'center', gap: 10,
//                           width: '100%', padding: '9px 12px', border: 'none',
//                           background: 'none', cursor: 'pointer', fontSize: 13,
//                           color: '#1e293b', textAlign: 'left',
//                           transition: 'background 0.1s',
//                         }}
//                         onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
//                         onMouseLeave={e => (e.currentTarget.style.background = 'none')}
//                       >
//                         <span style={{ color: '#94a3b8', display: 'flex' }}><IconMail /></span>
//                         {s}
//                       </button>
//                     ))}
//                   </div>
//                 )}
//               </div>
//             </div>

//             {/* ── Mot de passe — UN SEUL œil à droite ── */}
//             <div className="form-group">
//               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
//                 <label className="form-label" style={{ marginBottom: 0 }}>Mot de passe</label>
//                 {/* Lien fonctionnel avec Link React Router */}
//                 <Link
//                   to="/forgot-password"
//                   style={{ fontSize: 12, color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
//                 >
//                   Mot de passe oublié ?
//                 </Link>
//               </div>
//               <div style={{ position: 'relative' }}>
//                 <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex', pointerEvents: 'none' }}>
//                   <IconLock />
//                 </span>
//                 <input
//                   className="form-control"
//                   style={{ paddingLeft: 36, paddingRight: 42 }}
//                   type={showPwd ? 'text' : 'password'}
//                   placeholder="••••••••"
//                   value={password}
//                   onChange={e => setPassword(e.target.value)}
//                   required
//                   autoComplete="current-password"
//                 />
//                 {/* UN SEUL œil — affiche l'état inverse du mot de passe */}
//                 <button
//                   type="button"
//                   onClick={() => setShowPwd(!showPwd)}
//                   title={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
//                   style={{
//                     position: 'absolute', right: 10, top: '50%',
//                     transform: 'translateY(-50%)',
//                     background: 'none', border: 'none', cursor: 'pointer',
//                     color: showPwd ? '#2563eb' : '#94a3b8',
//                     display: 'flex', padding: 4, borderRadius: 4,
//                     transition: 'color 0.15s',
//                   }}
//                 >
//                   {showPwd ? <IconEyeOff /> : <IconEye />}
//                 </button>
//               </div>
//             </div>

//             <button
//               type="submit"
//               className="btn btn-primary"
//               style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', fontSize: 14, marginTop: 6, gap: 8 }}
//               disabled={loading}
//             >
//               {loading
//                 ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Connexion en cours…</>
//                 : <>Se connecter <IconArrow /></>
//               }
//             </button>
//           </form>

//           <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0', color: '#cbd5e1', fontSize: 12 }}>
//             <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
//             accès réservé au personnel
//             <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
//           </div>

//           <p style={{ textAlign: 'center', fontSize: 13, color: '#64748b' }}>
//             Pas encore de compte ?{' '}
//             <Link to="/register" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>
//               S'inscrire
//             </Link>
//           </p>
//         </div>
//       </div>
//     </div>
//   )
// }



import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const IconMail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
)
const IconLock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)
const IconEyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
)

const EMAIL_SUGGESTIONS = ['admin@nirinfo.mg', 'gestionnaire@nirinfo.mg']

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSugg, setShowSugg] = useState(false)

  const handleEmailChange = (val: string) => {
    setEmail(val)
    if (val.length > 0) {
      const filtered = EMAIL_SUGGESTIONS.filter(s => s.toLowerCase().startsWith(val.toLowerCase()))
      setSuggestions(filtered)
      setShowSugg(filtered.length > 0)
    } else {
      setShowSugg(false)
    }
  }

  const selectSuggestion = (s: string) => {
    setEmail(s)
    setShowSugg(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowSugg(false)
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap');

        .auth-page * { font-family: 'Poppins', sans-serif; box-sizing: border-box; }

        .auth-page {
          min-height: 100vh;
          background: linear-gradient(90deg, #e2e2e2, #c9d6ff);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .auth-container {
          position: relative;
          width: 850px;
          height: 550px;
          background: #fff;
          border-radius: 30px;
          box-shadow: 0 0 30px rgba(0,0,0,0.2);
          overflow: hidden;
        }

        .auth-form-box {
          position: absolute;
          right: 0;
          width: 50%;
          height: 100%;
          background: #fff;
          display: flex;
          align-items: center;
          color: #333;
          padding: 40px;
          z-index: 1;
          overflow-y: auto;
        }

        .auth-form-box form { width: 100%; }

        .auth-form-box h1 {
          font-size: 30px;
          font-weight: 700;
          margin-bottom: 20px;
          color: #333;
        }

        .auth-input-box {
          position: relative;
          margin: 18px 0;
        }

        .auth-input-box input {
          width: 100%;
          padding: 13px 50px 13px 20px;
          background: #eee;
          border-radius: 8px;
          border: none;
          outline: none;
          font-size: 15px;
          color: #333;
          font-weight: 500;
          font-family: 'Poppins', sans-serif;
        }

        .auth-input-box input::placeholder { color: #888; font-weight: 400; }

        .auth-input-icon {
          position: absolute;
          right: 15px;
          top: 50%;
          transform: translateY(-50%);
          color: #888;
          display: flex;
          pointer-events: none;
        }

        .auth-eye-btn {
          position: absolute;
          right: 15px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #888;
          display: flex;
          padding: 0;
        }

        .auth-forgot {
          margin: -8px 0 10px;
          text-align: right;
        }

        .auth-forgot a {
          font-size: 13px;
          color: #555;
          text-decoration: none;
        }

        .auth-btn {
          width: 100%;
          height: 46px;
          background: #7494ec;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 15px;
          color: #fff;
          font-weight: 600;
          font-family: 'Poppins', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 6px;
        }

        .auth-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .auth-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 16px 0 12px;
          font-size: 12px;
          color: #aaa;
        }

        .auth-divider::before, .auth-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }

        .auth-link-row {
          text-align: center;
          font-size: 13px;
          color: #666;
        }

        .auth-link-row a {
          color: #7494ec;
          font-weight: 600;
          text-decoration: none;
        }

        /* Toggle panel */
        .auth-toggle-box {
          position: absolute;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        .auth-toggle-box::before {
          content: '';
          position: absolute;
          left: -250px;
          width: 80%;
          height: 100%;
          background: #7494ec;
          border-radius: 150px;
          z-index: 2;
          transition: 1.8s ease-in-out;
        }

        .auth-toggle-panel {
          position: absolute;
          width: 50%;
          height: 100%;
          color: #fff;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          z-index: 3;
          pointer-events: all;
          padding: 30px;
        }

        .auth-toggle-panel h1 { font-size: 28px; font-weight: 700; margin-bottom: 10px; }
        .auth-toggle-panel p  { font-size: 14px; margin-bottom: 20px; }

        .auth-toggle-btn {
          width: 160px;
          height: 46px;
          background: transparent;
          border: 2px solid #fff;
          border-radius: 8px;
          color: #fff;
          font-size: 15px;
          font-weight: 600;
          font-family: 'Poppins', sans-serif;
          cursor: pointer;
        }

        .toggle-left { left: 0; }
        .toggle-right { right: -50%; transition-delay: 0.6s; }

        /* Suggestion dropdown */
        .sugg-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 50;
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          margin-top: 4px;
          overflow: hidden;
        }

        .sugg-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 9px 12px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 13px;
          color: #1e293b;
          text-align: left;
          font-family: 'Poppins', sans-serif;
        }

        .sugg-item:hover { background: #f8fafc; }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="auth-page">
        <div className="auth-container">

          {/* Formulaire login */}
          <div className="auth-form-box">
            <form onSubmit={handleSubmit}>
              <h1>Connexion</h1>

              {/* Email */}
              <div className="auth-input-box" style={{ position: 'relative' }}>
                <input
                  type="email"
                  placeholder="admin@nirinfo.mg"
                  value={email}
                  onChange={e => handleEmailChange(e.target.value)}
                  onFocus={() => email.length > 0 && suggestions.length > 0 && setShowSugg(true)}
                  onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                  required
                  autoComplete="email"
                />
                <span className="auth-input-icon"><IconMail /></span>
                {showSugg && (
                  <div className="sugg-dropdown">
                    {suggestions.map(s => (
                      <button key={s} type="button" className="sugg-item" onMouseDown={() => selectSuggestion(s)}>
                        <IconMail /> {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mot de passe */}
              <div className="auth-input-box">
                <input
                  type={showPwd ? 'text' : 'password'}
                  placeholder="••••••••"
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

              <div className="auth-forgot">
                <Link to="/forgot-password">Mot de passe oublié ?</Link>
              </div>

              <button type="submit" className="auth-btn" disabled={loading}>
                {loading
                  ? <><span className="spinner" /> Connexion…</>
                  : 'Se connecter'
                }
              </button>

              <div className="auth-divider">accès réservé au personnel</div>

              <div className="auth-link-row">
                Pas de compte ?{' '}
                <Link to="/register">S'inscrire</Link>
              </div>
            </form>
          </div>

          {/* Toggle panel */}
          <div className="auth-toggle-box">
            <div className="auth-toggle-panel toggle-left">
              <h1>Saisir votre compte</h1>
              <p>Pas encore de compte ?</p>
              <Link to="/register">
                <button className="auth-toggle-btn">S'inscrire</button>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}