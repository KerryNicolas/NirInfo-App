import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '../../components/Sidebar'
import CompteTab from './CompteTab'
import GererTab from './GererTab'
import TransferTab from './TransferTab'

export default function BudgetsPage() {
  return (
    <div className="app-layout">
      <Sidebar section="budgets" />
      <div className="main-content">
        <div className="top-bar">
          <span className="top-bar-title">Gestion des budgets</span>
        </div>
        <div style={{ padding: 24 }}>
          <Routes>
            <Route path="comptes"    element={<CompteTab />} />
            <Route path="gerer"      element={<GererTab />} />
            <Route path="transferts" element={<TransferTab />} />
            <Route path="*" element={<Navigate to="/budgets/comptes" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}