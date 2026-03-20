import { useState } from 'react'
import EtudiantTab    from './EtudiantTab'
import InscriptionTab from './InscriptionTab'
import RecouvrementTab from './RecouvrementTab'
import PointageTab    from './PointageTab'

type Tab = 'etudiant' | 'inscription' | 'recouvrement' | 'pointage'

export default function EtudiantMain() {
  const [tab, setTab] = useState<Tab>('etudiant')

  return (
    <div className="page-body">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Etudiant</h2>
        <div style={{ width: 40, height: 3, background: '#2563eb', borderRadius: 2, marginTop: 4 }} />
      </div>

      <div className="tabs">
        {([
          ['etudiant',     'Etudiant'],
          ['inscription',  'Inscription'],
          ['recouvrement', 'Recouvrement'],
          ['pointage',     'Historique pointage'],
        ] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
            {l}
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
