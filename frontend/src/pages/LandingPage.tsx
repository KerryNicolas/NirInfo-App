import { Link } from 'react-router-dom'
import Logo from '../assets/lgo.png'


export default function LandingPage() {
  return (
    <div className="hero-page">
      {/* Navbar */}
        <nav className="hero-nav">
        <div className="hero-nav-logo">
          <div style={{ width: 40, height: 36, background: '#eef1f7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={Logo} alt="Logo" height="36" style={{ objectFit: 'contain', borderRadius: 4 }} />
          </div>
          Nir'Info
        </div>

        <ul className="hero-nav-links">
          <li><a href="#">Accueil</a></li>
          <li><a href="#">Formations</a></li>
          <li><a href="#">Éducation</a></li>
          <li><a href="#">Tarifs</a></li>
        </ul>
        <Link to="/login" className="btn-hero-primary" style={{ padding: '9px 20px', fontSize: 14 }}>
          Espace Admin
        </Link>
      </nav>

      {/* Hero body */}
      <div className="hero-body">
        <div className="hero-actions">
          <Link to="/login" className="btn-hero-primary">
            Voir les formations →
          </Link>
          <a href="#" className="btn-hero-secondary">
            Nos tarifs
          </a>
        </div>
      </div>
    </div>
  )
}
