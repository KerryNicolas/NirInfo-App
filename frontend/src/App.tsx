import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage          from './pages/LoginPage'
import CreateUserPage     from './pages/CreateUserPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage  from './pages/ResetPasswordPage'
import DashboardMenu      from './pages/DashboardMenu'
import FormationPage      from './pages/formation/FormationPage'
import EtudiantPage       from './pages/formation/etudiant/EtudiantPage'
import LogistiquePage     from './pages/logistique/LogistiquePage'
import PersonnelPage      from './pages/personnel/PersonnelPage'
import EtatPage           from './pages/formation/EtatPage'
import EcheancePage       from './pages/formation/EcheancePage'
import CertificationPage  from './pages/formation/CertificationPage'
import ProfilePage        from './pages/ProfilePage'
import ServicesPage       from './pages/services/ServicesPage'
import BudgetsPage        from './pages/budgets/BudgetsPage'
import { ReactNode } from 'react'
import FacturePage from './pages/formation/FacturePage'

// FIX : "token" n'existe plus dans AuthContext depuis le passage à l'auth par
// cookie de session — c'est la présence de "user" qui indique une session active.
function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-center"><div className="spinner"/></div>
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-center"><div className="spinner"/></div>
  return !user ? <>{children}</> : <Navigate to="/dashboard" replace />
}

// FIX : nouvelle garde — protège /admin/create-user en plus de l'authentification,
// vérifie aussi que l'utilisateur est bien admin (double protection, cohérent avec
// la vérification déjà faite côté backend dans AuthController::createUser()).
function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  if (loading) return <div className="loading-center"><div className="spinner"/></div>
  if (!user) return <Navigate to="/login" replace />
  return isAdmin() ? <>{children}</> : <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Pages publiques ── */}
      <Route path="/"                element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password"  element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

      {/* FIX : /register public supprimé — remplacé par une route admin-only */}
      <Route path="/admin/create-user" element={<AdminRoute><CreateUserPage /></AdminRoute>} />

      {/* ── Pages privées ── */}
      <Route path="/dashboard"     element={<PrivateRoute><DashboardMenu /></PrivateRoute>} />
      <Route path="/formation/*"   element={<PrivateRoute><FormationPage /></PrivateRoute>} />
      <Route path="/etudiant/*"    element={<PrivateRoute><EtudiantPage /></PrivateRoute>} />
      <Route path="/logistique"    element={<PrivateRoute><LogistiquePage /></PrivateRoute>} />
      <Route path="/personnel"     element={<PrivateRoute><PersonnelPage /></PrivateRoute>} />

      {/* ── Facture */}
      <Route path="/facture"       element={<PrivateRoute><FacturePage /></PrivateRoute>} />
      <Route path="/etat"          element={<PrivateRoute><EtatPage /></PrivateRoute>} />
      <Route path="/echéance"      element={<PrivateRoute><EcheancePage /></PrivateRoute>} />
      <Route path="/certification" element={<PrivateRoute><CertificationPage /></PrivateRoute>} />
      <Route path="/profile"       element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

      {/* FIX : Services et Gestion des budgets — réservés admin, wildcard pour sous-routes */}
      <Route path="/services/*" element={<AdminRoute><ServicesPage /></AdminRoute>} />
      <Route path="/budgets/*"  element={<AdminRoute><BudgetsPage /></AdminRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: { fontSize: '13px', fontFamily: 'inherit' },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}