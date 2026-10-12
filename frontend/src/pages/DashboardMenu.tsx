import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Logo from '../assets/logo.png'
import ParametresModal from '../components/ParametresModal'
import Avatar from '../components/Avatar'
import { IcoLogoutRed, IcoSettings, IcoFormation, IcoTruck, IcoUsers, IcoServices, IcoBudget } from '.././components/icons'

const baseMenuItems = [
  { label: 'Formations',        to: '/formation',  icon: <IcoFormation />, active: true  },
  { label: 'Logistiques',       to: '/logistique', icon: <IcoTruck />,     active: true  },
  { label: 'Personnels',         to: '/personnel',  icon: <IcoUsers />,     active: true  },
]

// FIX : réservés à l'admin — un user simple ne doit ni les voir ni y accéder,
// conformément au cahier des charges (Services + Gestion des budgets = admin only)
const adminOnlyMenuItems = [
  { label: 'Services',          to: '/services', icon: <IcoServices />,  active: true },
  { label: 'Gestion des budgets', to: '/budgets', icon: <IcoBudget />,    active: true },
]

interface Stats {
  total_etudiants: number
  sessions_actives: number
  inscriptions_mois: number
  revenus_mois: number
}

export default function DashboardMenu() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()
  // « Paramètres » ouvre la fenêtre du profil par-dessus le menu, sans changer de page.
  const [parametres, setParametres] = useState(false)

  const handleLogout = async () => { await logout(); navigate('/login') }

  // FIX : Services + Gestion des budgets ajoutés uniquement si admin
  const menuItems = isAdmin() ? [...baseMenuItems, ...adminOnlyMenuItems] : baseMenuItems

  return (
    <div className="dash-page">

      {/* ── Top bar ── */}
      <div className="dash-topbar">
        <div className="dash-topbar-logo">
          <img src={Logo} alt="Logo" />
        </div>
        <div className="dash-topbar-right">
          <span className="dash-topbar-greeting">
            Bonjour, <b>{user?.name}</b>
          </span>
          {/* La photo en haut ouvre la même fenêtre que le bouton « Paramètres ». */}
          <button type="button" onClick={() => setParametres(true)} title="Paramètres" aria-label="Paramètres"
            style={{ background: 'none', border: 'none', padding: 0, borderRadius: '50%', cursor: 'pointer', display: 'flex' }}>
            <Avatar name={user?.name} photoUrl={user?.photo_url} size={38} />
          </button>
          <button className="dash-btn-logout" onClick={handleLogout}>
            <IcoLogoutRed /> Déconnexion
          </button>
        </div>
      </div>

      {/* ── Zone centrale ── */}
      <div className="dash-center">
        <div className="dash-menu-card">

          {/* En-tête */}
          <div className="dash-menu-header">
            <h2>Menu principal</h2>
          </div>

          {/* Items */}
          <div className="dash-menu-list">
            {menuItems.map(m => (
              m.active ? (
                <Link key={m.label} to={m.to} className="dash-menu-item">
                  <span className="dash-menu-item-icon">{m.icon}</span>
                  {m.label}
                </Link>
              ) : (
                <div key={m.label} className="dash-menu-item-disabled">
                  <div className="dash-menu-item-disabled-left">
                    <span>{m.icon}</span>
                    {m.label}
                  </div>
                  <span className="dash-badge-soon">bientôt</span>
                </div>
              )
            ))}
          </div>

          {/* Pied */}
          <div className="dash-menu-footer">
            <button className="dash-btn-settings" onClick={() => setParametres(true)}>
              <IcoSettings /> Paramètres
            </button>
            <button className="dash-btn-logout-sm" onClick={handleLogout}>
              <IcoLogoutRed /> Déconnexion
            </button>
          </div>

        </div>
      </div>

      <ParametresModal open={parametres} onClose={() => setParametres(false)} />

    </div>
  )
}