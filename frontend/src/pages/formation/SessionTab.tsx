import { useState } from 'react'
import SessionForm    from './SessionForm'
import HoraireForm    from './HoraireForm'
import SessionEnCours from './SessionEnCours'

type SubTab = 'session' | 'horaire' | 'en-cours'

export default function SessionTab() {
  const [tab, setTab] = useState<SubTab>('session')

  return (
    <div className="page-body">
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Session</h2>
        <div style={{ width: 40, height: 3, background: '#2563eb', borderRadius: 2, marginTop: 4 }} />
      </div>

      <div className="tabs">
        {([
          ['session',  'Session'],
          ['horaire',  'Horaire'],
          ['en-cours', 'Session en cours'],
        ] as [SubTab, string][]).map(([k, l]) => (
          <button key={k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'session'  && <SessionForm />}
      {tab === 'horaire'  && <HoraireForm />}
      {tab === 'en-cours' && <SessionEnCours />}
    </div>
  )
}
