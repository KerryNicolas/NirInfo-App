import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Sidebar    from '../../components/Sidebar'
import ModuleTab  from './Module/ModuleTab'
import SessionTab from './Session/SessionTab'
import HoraireTab from './Session/HoraireForm'

export default function FormationPage() {
  const { hasPermission, loading } = useAuth()
  // Gestion des modules : administrateur principal uniquement. Les autres
  // comptes arrivent sur Session (le serveur refuse aussi toute écriture).
  const canManageModules = hasPermission('modules.manage')
  // Tant que la session se charge, les permissions sont inconnues : on
  // attend avant de rediriger, sinon un rechargement de /formation/module
  // renverrait l'administrateur principal vers Session.
  const attente = <div className="loading-center"><div className="spinner"/></div>

  return (
    <div className="app-layout">
      <Sidebar section="formation" />
      <div className="main-content">
        <Routes>
          <Route path="module"  element={
            loading ? attente : canManageModules ? <ModuleTab /> : <Navigate to="/formation/session" replace />
          } />
          <Route path="session" element={<SessionTab />} />
          <Route path="horaire" element={<HoraireTab />} />
          <Route path="*"       element={
            loading ? attente : <Navigate to={canManageModules ? 'module' : 'session'} replace />
          } />
        </Routes>
      </div>
    </div>
  )
}
