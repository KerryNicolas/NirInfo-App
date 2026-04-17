import { useState } from 'react'
import EtudiantTab     from './EtudiantTab'
import InscriptionTab  from './InscriptionTab'
import RecouvrementTab from './RecouvrementTab'
import PointageTab     from './PointageTab'

type Tab = 'etudiant' | 'inscription' | 'recouvrement' | 'pointage'

/* ── Icônes SVG pour les onglets ── */
const IcoStudent = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
)
const IcoClipboard = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <rect x="8" y="2" width="8" height="4" rx="1"/>
  </svg>
)
const IcoRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)
const IcoCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
  </svg>
)

const tabs: [Tab, string, JSX.Element][] = [
  ['etudiant',     'Étudiant',          <IcoStudent />],
  ['inscription',  'Inscription',       <IcoClipboard />],
  ['recouvrement', 'Recouvrement',      <IcoRefresh />],
  ['pointage',     'Historique pointage', <IcoCalendar />],
]

export default function EtudiantMain() {
  const [tab, setTab] = useState<Tab>('etudiant')

  return (
    <div className="page-body">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Étudiant</h2>
        <div style={{ width: 40, height: 3, background: '#2563eb', borderRadius: 2, marginTop: 4 }} />
      </div>

      <div className="tabs">
        {tabs.map(([k, l, icon]) => (
          <button key={k}
            className={`tab-btn${tab === k ? ' active' : ''}`}
            onClick={() => setTab(k)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {icon} {l}
          </button>
        ))}
      </div>

      {tab === 'etudiant'     && <EtudiantTab />}
      {tab === 'inscription'  && <InscriptionTab />}
      {tab === 'recouvrement' && <RecouvrementTab />}
      {tab === 'pointage'     && <PointageTab />}
    </div>
  )
}