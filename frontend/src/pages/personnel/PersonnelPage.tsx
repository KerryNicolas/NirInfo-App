import { useState } from 'react'
import Sidebar from '../../components/Sidebar'
import PersonnelTab from './PersonnelTab'
import FonctionTab from './FonctionTab'

type Tab = 'personnel' | 'fonction'

// FIX : cette page réimplémentait tout en interne (formulaires, tableaux,
// suppression...) alors que PersonnelTab.tsx et FonctionTab.tsx existaient
// déjà à côté sans jamais être utilisés (composants orphelins, en plus
// désynchronisés de l'API réelle — /personnels au pluriel au lieu de
// /personnel). Toute la logique a été déplacée dans ces deux fichiers ;
// PersonnelPage.tsx ne fait plus que le sidebar + le routage d'onglet,
// exactement comme ModuleTab/PrestationTab le font pour Formation/Services.
export default function PersonnelPage() {
  const [tab, setTab] = useState<Tab>('personnel')

  return (
    <div className="app-layout">
      <Sidebar section="personnel" activeTab={tab} onTabChange={(t) => setTab(t as Tab)} />

      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title" style={{ display:'flex', alignItems:'center', gap:8 }}>Personnel</span>
        </div>
        <div style={{ padding: '4px 24px 24px' }}>
          {tab === 'personnel' ? <PersonnelTab /> : <FonctionTab />}
        </div>
      </div>
    </div>
  )
}