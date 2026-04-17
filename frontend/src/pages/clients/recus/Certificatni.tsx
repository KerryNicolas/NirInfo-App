import React, { useState } from 'react'
import logo from '../../../assets/logo.png'
import './Certificatni.css'
import { Award } from 'lucide-react'

export default function CertificatPremium() {
  const [nom, setNom] = useState('')
  const [matricule, setMatricule] = useState('')
  const [formation, setFormation] = useState('')
  const [date, setDate] = useState('')

  const handlePrint = () => {
    // Injecte un style global pour forcer la conservation des couleurs/arrière-plans
    const style = document.createElement('style')
    style.id = 'print-color-fix'
    style.innerHTML = `
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    `
    document.head.appendChild(style)
    window.print()
    // Retire le style après impression
    setTimeout(() => {
      const el = document.getElementById('print-color-fix')
      if (el) el.remove()
    }, 1000)
  }

  return (
      // <div style={{ 
      //     position: 'fixed',
      //     inset: 0,
      //     overflow: 'auto',
      //     background: '#e5e7eb',
      //     zIndex: 0
      //   }}>
        <div className="page-container">

          {/* FORMULAIRE GAUCHE */}
          <div className="formulaire no-print">
            <h2>Générer un certificat</h2>

            <input
              placeholder="Nom complet"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
            />
            <input
              placeholder="Matricule"
              value={matricule}
              onChange={(e) => setMatricule(e.target.value)}
            />
            <input
              placeholder="Formation"
              value={formation}
              onChange={(e) => setFormation(e.target.value)}
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <button onClick={handlePrint}>🖨️ Imprimer</button>
          </div>

          {/* CERTIFICAT DROITE */}
          <div className="certificat-premium">
            <div className="inner-border">

              {/* BADGES */}
              <div className="badge-left">
                <Award size={80} color="#FFD700" />
              </div>
              <img src={logo} alt="Nir'Info" className="logo-img" />
              <div className="badge-right">
                <Award size={80} color="#FFD700" />
              </div>

              {/* TITRE */}
              <h1>CERTIFICAT</h1>
              <p>DE REUSSITE</p>

              <p className="present">Décerné à :</p>

              <h2 className="nom">{nom || 'Nom Prénom'}</h2>

              <p className="date">Né(e) le : {date || 'Date'}</p>

              <p className="info">Matricule : {matricule || 'XXXX'}</p>

              <p className="desc">Pour avoir suivi avec succès la formation</p>

              <h2 className="formation">{formation || 'Nom de la formation'}</h2>
              <br />

              {/* SIGNATURE */}
              <div className="signatures">
                <div>
                  <p>Signature Étudiant</p>
                  <div className="line"></div>
                </div>
                <div>
                  <p>Le Directeur</p>
                  <div className="line"></div>
                </div>
              </div>

            </div>
          </div>

        </div>
    // </div>,
  )
}
