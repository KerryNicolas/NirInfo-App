import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="hero-page">
      {/* Navbar */}
      <nav className="hero-nav">
        <div className="hero-nav-logo">
          <div style={{ width: 36, height: 36, background: '#3b82f6', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🎓
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
        <div className="hero-badge">
          <span className="dot" />
          Inscriptions ouvertes pour 2026
        </div>
        <h1 className="hero-h1">
          Formez-vous pour<br />
          <span>l'avenir</span> professionnel
        </h1>
        <p className="hero-subtitle">
          Des formations professionnelles de qualité pour booster votre carrière.
          Rejoignez des milliers d'étudiants qui font confiance à notre centre.
        </p>
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
