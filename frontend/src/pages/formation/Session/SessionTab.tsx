import { useState } from 'react'
import SessionForm    from './SessionForm'
import HoraireForm    from './HoraireForm'
import LieuForm       from './LieuForm'
import SessionEnCours from './SessionEnCours'
import { IcoClock} from '../../../components/icons'

type SubTab = 'session' | 'horaire' | 'lieu' | 'en-cours'

export default function SessionTab() {
  const [tab, setTab] = useState<SubTab>('session')

  return (
    <div className="app-layout">  
      <div className="main-content">
       <div className="top-bar">
          <span className="top-bar-title" style={{ display:'flex', alignItems:'center', gap:8 }}><IcoClock /> Session  </span>
       </div>
      <div className="tabs">
        {([
          ['session',  'Session'],
          ['horaire',  'Horaire'],
          ['lieu',     'Lieu'],
          ['en-cours', 'Session en cours'],
        ] as [SubTab, string][]).map(([k, l]) => (
          <button key={k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ padding: '4px 24px 24px' }}>
        {tab === 'session'  && <SessionForm />}
        {tab === 'horaire'  && <HoraireForm />}
        {tab === 'lieu'     && <LieuForm />}
        {tab === 'en-cours' && <SessionEnCours />}
      </div>
    </div>
    </div>
  )
}