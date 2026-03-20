import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar    from '../../components/Sidebar'
import ModuleTab  from './ModuleTab'
import SessionTab from './SessionTab'
import HoraireTab from './HoraireForm'

export default function FormationPage() {
  return (
    <div className="app-layout">
      <Sidebar section="formation" />
      <div className="main-content">
        <Routes>
          <Route path="module"  element={<ModuleTab />} />
          <Route path="session" element={<SessionTab />} />
          <Route path="horaire" element={<HoraireTab />} />
          <Route path="*"       element={<Navigate to="module" replace />} />
        </Routes>
      </div>
    </div>
  )
}