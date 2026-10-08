import { useState } from 'react'
import Sidebar from '../../../components/Sidebar'
import { useAuth } from '../../../contexts/AuthContext'
import CertificationAuto from './CertificationAuto'
import CertificationManuelle from './CertificationManuelle'
import ModifierPrix from './ModifierPrix'
import MontantPercu from './MontantPercu'
import { IcoCertif } from '../../../components/icons'
import type { Certification } from './types'

// Conteneur du module Certification : il ne gère que la mise en page et
// les onglets. Chaque onglet vit dans son propre fichier (même dossier).
// Export par défaut inchangé (CertificationPage) : seul le chemin
// d'import change dans le routeur (CertificationTab → CertificationPage).

type SubTab = 'certification' | 'manuelle' | 'prix' | 'montant'

export default function CertificationPage() {
  const { isAdmin } = useAuth()
  const admin = isAdmin()
  const [tab, setTab] = useState<SubTab>('certification')
  // Certificat manuel en cours de correction (ouvert depuis la liste).
  const [editManuel, setEditManuel] = useState<Certification | null>(null)

  // adminOnly : l'onglet n'est ni affiché ni rendu pour un non-admin.
  const tabs: { key: SubTab; label: string; adminOnly?: boolean }[] = [
    { key: 'certification', label: 'Certification' },
    { key: 'manuelle',      label: 'Saisie manuelle', adminOnly: true },
    { key: 'prix',          label: 'Modifier prix',   adminOnly: true },
    { key: 'montant',       label: 'Montant perçu' },
  ]
  const visibles = tabs.filter(t => !t.adminOnly || admin)
  // Si l'onglet courant n'est pas autorisé, on retombe sur le mode automatique.
  const actif: SubTab = visibles.some(t => t.key === tab) ? tab : 'certification'

  return (
    <div className="app-layout">
      <Sidebar section="formation" />
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title" style={{ display:'flex', alignItems:'center', gap:8 }}><IcoCertif /> Certification</span>
        </div>
        <div style={{ padding:24, marginTop:-20 }}>
          <div className="tabs">
            {visibles.map(t => (
              <button key={t.key} className={`tab-btn${actif === t.key ? ' active' : ''}`} onClick={() => { setEditManuel(null); setTab(t.key) }}>{t.label}</button>
            ))}
          </div>

          {actif === 'certification' && (
            <CertificationAuto onEditManuel={admin ? c => { setEditManuel(c); setTab('manuelle') } : undefined} />
          )}
          {actif === 'manuelle' && (
            <CertificationManuelle
              key={editManuel?.reference ?? 'nouveau'}
              editing={editManuel}
              onDone={() => { setEditManuel(null); setTab('certification') }}
            />
          )}
          {actif === 'prix' && <ModifierPrix />}
          {actif === 'montant' && <MontantPercu />}
        </div>
      </div>
    </div>
  )
}