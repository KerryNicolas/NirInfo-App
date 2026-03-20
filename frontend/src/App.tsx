import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LandingPage        from './pages/LandingPage'
import LoginPage          from './pages/LoginPage'
import RegisterPage       from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage  from './pages/ResetPasswordPage'
import DashboardMenu      from './pages/DashboardMenu'
import FormationPage      from './pages/formation/FormationPage'
import EtudiantPage       from './pages/etudiant/EtudiantPage'
import FacturePage        from './pages/FacturePage'
import EtatPage           from './pages/EtatPage'
import EcheancePage       from './pages/EcheancePage'
import CertificationPage  from './pages/CertificationPage'
import ProfilePage        from './pages/ProfilePage'
import { ReactNode } from 'react'

function PrivateRoute({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) return <div className="loading-center"><div className="spinner"/></div>
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) return <div className="loading-center"><div className="spinner"/></div>
  return !token ? <>{children}</> : <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  return (
    <Routes>
      {/* Pages publiques */}
      <Route path="/"                element={<LandingPage />} />
      <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register"        element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password"  element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

      {/* Pages privées */}
      <Route path="/dashboard"       element={<PrivateRoute><DashboardMenu /></PrivateRoute>} />
      <Route path="/formation/*"     element={<PrivateRoute><FormationPage /></PrivateRoute>} />
      <Route path="/etudiant/*"      element={<PrivateRoute><EtudiantPage /></PrivateRoute>} />
      <Route path="/facture"         element={<PrivateRoute><FacturePage /></PrivateRoute>} />
      <Route path="/etat"            element={<PrivateRoute><EtatPage /></PrivateRoute>} />
      <Route path="/echeance"        element={<PrivateRoute><EcheancePage /></PrivateRoute>} />
      <Route path="/certification"   element={<PrivateRoute><CertificationPage /></PrivateRoute>} />
      <Route path="/profile"         element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

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