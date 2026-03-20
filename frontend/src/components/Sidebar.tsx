import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface Props { section: 'formation' | 'etudiant' | 'facture' }

const menus = {
  formation: [
    { label: 'Module',     to: '/formation/module' },
    { label: 'Session',    to: '/formation/session' },
    { label: 'Etudiant',   to: '/etudiant/etudiant' },
    { label: 'Facture',    to: '/facture' },
    { label: 'Etat',       to: '#' },
    { label: 'Échéance',   to: '#' },
    { label: 'Certification', to: '#' },
    { label: 'Retour',     to: '/dashboard' },
  ],
  etudiant: [
    { label: 'Module',     to: '/formation/module' },
    { label: 'Session',    to: '/formation/session' },
    { label: 'Etudiant',   to: '/etudiant/etudiant' },
    { label: 'Facture',    to: '/facture' },
    { label: 'Etat',       to: '#' },
    { label: 'Échéance',   to: '#' },
    { label: 'Certification', to: '#' },
    { label: 'Retour',     to: '/dashboard' },
  ],
  facture: [
    { label: 'Module',     to: '/formation/module' },
    { label: 'Session',    to: '/formation/session' },
    { label: 'Etudiant',   to: '/etudiant/etudiant' },
    { label: 'Facture',    to: '/facture' },
    { label: 'Etat',       to: '#' },
    { label: 'Échéance',   to: '#' },
    { label: 'Certification', to: '#' },
    { label: 'Retour',     to: '/dashboard' },
  ],
}

const icons: Record<string, string> = {
  Module: '📦', Session: '📅', Etudiant: '👤', Facture: '🧾',
  Etat: '📊', Échéance: '📆', Certification: '🏅', Retour: '🏠',
}

export default function Sidebar({ section }: Props) {
  const { logout } = useAuth()
  const navigate   = useNavigate()

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">🎓</div>
        <span>Formation</span>
      </div>
      <nav className="sidebar-nav">
        {menus[section].map(m => (
          m.to === '#'
            ? <button key={m.label} className="sidebar-nav-btn" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', color:'#94a3b8', background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:500, width:'100%' }}>
                <span>{icons[m.label]}</span><span>{m.label}</span>
              </button>
            : <NavLink key={m.label} to={m.to}
                className={({ isActive }) => isActive ? 'active' : ''}>
                <span className="nav-icon">{icons[m.label]}</span>
                <span>{m.label}</span>
              </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button onClick={() => { logout(); navigate('/login') }}
          style={{ width:'100%', background:'rgba(239,68,68,0.15)', color:'#fca5a5', border:'none', borderRadius:7, padding:'8px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
          ⏻ Déconnexion
        </button>
      </div>
    </div>
  )
}
