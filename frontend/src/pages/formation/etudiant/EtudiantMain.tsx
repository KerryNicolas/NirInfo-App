import { useState } from 'react'
import EtudiantTab     from './EtudiantTab'
import InscriptionTab  from './InscriptionTab'
import RecouvrementTab from './RecouvrementTab'
import PointageTab     from './PointageTab'
import { IcoStudent, IcoClipboard, IcoRefresh, IcoClock, IcoCalendar } from '../../../components/icons'

type Tab = 'etudiant' | 'inscription' | 'recouvrement' | 'pointage'

const tabs: [Tab, string, JSX.Element][] = [
  ['etudiant',     'Étudiant',            <IcoStudent />],
  ['inscription',  'Inscription',         <IcoClipboard />],
  ['recouvrement', 'Recouvrement',        <IcoRefresh />],
  ['pointage',     'Historique pointage', <IcoCalendar />],
]

export default function EtudiantMain() {
  const [tab, setTab] = useState<Tab>('etudiant')
  // FIX : matricule transmis depuis EtudiantTab (bouton "+" sur une ligne)
  // vers InscriptionTab, pour pré-remplir le formulaire d'inscription.
  const [prefillMatricule, setPrefillMatricule] = useState<string | null>(null)

  const handleInscrire = (matricule: string) => {
    setPrefillMatricule(matricule)
    setTab('inscription')
  }

  return (
    <div className="app-layout">
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <IcoClock /> Etudiant
          </span>
        </div>
        <div className="tabs">
          {tabs.map(([k, l, icon]) => (
            <button key={k}
              className={`tab-btn${tab === k ? ' active' : ''}`}
              onClick={() => setTab(k)}
              style={{ display:'flex', alignItems:'center', gap:6 }}>
              {icon} {l}
            </button>
          ))}
        </div>

        <div style={{ padding: '4px 24px 24px' }}>
          {/* ✅ Tous les tabs restent montés, seul display change → pas de refetch */}
          <div style={{ display: tab === 'etudiant'     ? 'block' : 'none' }}><EtudiantTab onInscrire={handleInscrire} /></div>
          <div style={{ display: tab === 'inscription'  ? 'block' : 'none' }}>
            <InscriptionTab
              prefillMatricule={prefillMatricule}
              onPrefillConsumed={() => setPrefillMatricule(null)}
            />
          </div>
          <div style={{ display: tab === 'recouvrement' ? 'block' : 'none' }}><RecouvrementTab /></div>
          <div style={{ display: tab === 'pointage'     ? 'block' : 'none' }}><PointageTab /></div>
        </div>
      </div>
     </div>
  )
}