import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from '../../../components/Sidebar'
import EtudiantMain from './EtudiantMain'

export default function EtudiantPage() {
  return (
    <div className="app-layout">
      <Sidebar section="etudiant" />
      <div className="main-content">
        <Routes>
          <Route path="etudiant" element={<EtudiantMain />} />
          <Route path="*" element={<Navigate to="etudiant" replace />} />
        </Routes>
      </div>
    </div>
  )
}
