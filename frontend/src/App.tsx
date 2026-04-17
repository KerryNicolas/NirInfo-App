// import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
// import { Toaster } from 'react-hot-toast'
// import { AuthProvider, useAuth } from './contexts/AuthContext'
// import LandingPage        from './pages/LandingPage'
// import LoginPage          from './pages/LoginPage'
// import RegisterPage       from './pages/RegisterPage'
// import ForgotPasswordPage from './pages/ForgotPasswordPage'
// import ResetPasswordPage  from './pages/ResetPasswordPage'
// import DashboardMenu      from './pages/DashboardMenu'
// import FormationPage      from './pages/formation/FormationPage'
// import EtudiantPage       from './pages/etudiant/EtudiantPage'
// import LogistiquePage     from './pages/logistique/LogistiquePage'
// import PersonnelPage      from './pages/personnel/PersonnelPage'
// // import FacturePage        from './pages/FacturePage'
// import EtatPage           from './pages/EtatPage'
// import EcheancePage       from './pages/EcheancePage'
// import CertificationPage  from './pages/CertificationPage'
// import ProfilePage        from './pages/ProfilePage'
// import DashboardCertificat from './pages/clients/DashboardCertificat'
// // import DashboardCertificat from './pages/DashboardCertificat'
// import { ReactNode } from 'react'

// function PrivateRoute({ children }: { children: ReactNode }) {
//   const { token, loading } = useAuth()
//   if (loading) return <div className="loading-center"><div className="spinner"/></div>
//   return token ? <>{children}</> : <Navigate to="/login" replace />
// }

// function PublicRoute({ children }: { children: ReactNode }) {
//   const { token, loading } = useAuth()
//   if (loading) return <div className="loading-center"><div className="spinner"/></div>
//   return !token ? <>{children}</> : <Navigate to="/dashboard" replace />
// }

// function AppRoutes() {
//   return (
//     <Routes>
//       {/* Pages publiques */}
//       <Route path="/"                element={<LandingPage />} />
//       <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
//       <Route path="/register"        element={<PublicRoute><RegisterPage /></PublicRoute>} />
//       <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
//       <Route path="/reset-password"  element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

//       {/* Pages privées */}
//       <Route path="/dashboard"     element={<PrivateRoute><DashboardMenu /></PrivateRoute>} />
//       <Route path="/formation/*"   element={<PrivateRoute><FormationPage /></PrivateRoute>} />
//       <Route path="/etudiant/*"    element={<PrivateRoute><EtudiantPage /></PrivateRoute>} />

//       {/*
//         Logistique et Personnel sont des pages autonomes avec sidebar intégrée.
//         Elles n'ont PAS de sous-routes → pas de /* sinon React Router
//         cherche une route enfant et redirige vers * → accueil.
//       */}
//       <Route path="/logistique"    element={<PrivateRoute><LogistiquePage /></PrivateRoute>} />
//       <Route path="/personnel"     element={<PrivateRoute><PersonnelPage /></PrivateRoute>} />

//       {/* <Route path="/facture"       element={<PrivateRoute><FacturePage /></PrivateRoute>} /> */}
//       <Route path="/facture" element={<PrivateRoute><DashboardCertificat /></PrivateRoute>} />

//       <Route path="/etat"          element={<PrivateRoute><EtatPage /></PrivateRoute>} />
//       <Route path="/echéance"      element={<PrivateRoute><EcheancePage /></PrivateRoute>} />
//       <Route path="/certification" element={<PrivateRoute><CertificationPage /></PrivateRoute>} />
//       <Route path="/profile"       element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

//       <Route path="*" element={<Navigate to="/" replace />} />
//     </Routes>
//   )
// }

// export default function App() {
//   return (
//     <BrowserRouter>
//       <AuthProvider>
//         <Toaster
//           position="top-right"
//           toastOptions={{
//             duration: 3500,
//             style: { fontSize: '13px', fontFamily: 'inherit' },
//             success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
//             error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
//           }}
//         />
//         <AppRoutes />
//       </AuthProvider>
//     </BrowserRouter>
//   )
// }



// src/App.tsx
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
import LogistiquePage     from './pages/logistique/LogistiquePage'
import PersonnelPage      from './pages/personnel/PersonnelPage'
import EtatPage           from './pages/EtatPage'
import EcheancePage       from './pages/EcheancePage'
import CertificationPage  from './pages/CertificationPage'
import ProfilePage        from './pages/ProfilePage'
import DashboardCertificat from './pages/clients/DashboardCertificat'
// ✅ Nouveaux imports pour les deux pages liées aux boutons
import FactureNI          from './pages/clients/recus/factureni'
import CertificatNI       from './pages/clients/recus/certificatni'
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
      {/* ── Pages publiques ── */}
      <Route path="/"                element={<LandingPage />} />
      <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register"        element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password"  element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

      {/* ── Pages privées ── */}
      <Route path="/dashboard"     element={<PrivateRoute><DashboardMenu /></PrivateRoute>} />
      <Route path="/formation/*"   element={<PrivateRoute><FormationPage /></PrivateRoute>} />
      <Route path="/etudiant/*"    element={<PrivateRoute><EtudiantPage /></PrivateRoute>} />
      <Route path="/logistique"    element={<PrivateRoute><LogistiquePage /></PrivateRoute>} />
      <Route path="/personnel"     element={<PrivateRoute><PersonnelPage /></PrivateRoute>} />

      {/* ── Facture & Certificat ── */}
      {/* ✅ Page d'accueil choix : facture ou certificat */}
      <Route path="/facture"            element={<PrivateRoute><DashboardCertificat /></PrivateRoute>} />
      {/* ✅ Bouton "Facturation d'écolage" → factureni.tsx */}
      <Route path="/facture/ecolage"    element={<PrivateRoute><FactureNI /></PrivateRoute>} />
      {/* ✅ Bouton "Certificat de formation" → certificatni.tsx */}
      <Route path="/facture/certificat" element={<PrivateRoute><CertificatNI /></PrivateRoute>} />

      <Route path="/etat"          element={<PrivateRoute><EtatPage /></PrivateRoute>} />
      <Route path="/echéance"      element={<PrivateRoute><EcheancePage /></PrivateRoute>} />
      <Route path="/certification" element={<PrivateRoute><CertificationPage /></PrivateRoute>} />
      <Route path="/profile"       element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

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