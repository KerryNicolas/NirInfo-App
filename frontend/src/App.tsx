import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import SentinelleSession from './components/SentinelleSession'
import LoginPage          from './pages/LoginPage'
import DashboardMenu      from './pages/DashboardMenu'
import { ComponentType, ReactNode, Suspense, lazy } from 'react'

// PERFORMANCE : chaque page est un fichier séparé, téléchargé à la première
// visite seulement. La connexion et le menu principal restent dans le fichier
// de départ : ce sont les deux premiers écrans affichés.
//
// Après une mise en ligne, un onglet resté ouvert demande des fichiers de
// l'ancienne version, qui n'existent plus : la page est alors rechargée une
// fois (une seule, pour ne pas boucler si la panne est ailleurs).
const RECHARGE_KEY = 'nirinfo_page_rechargee'
function page(charger: () => Promise<{ default: ComponentType }>) {
  return lazy(() => charger().then(
    m => { sessionStorage.removeItem(RECHARGE_KEY); return m },
    err => {
      if (sessionStorage.getItem(RECHARGE_KEY)) throw err
      sessionStorage.setItem(RECHARGE_KEY, '1')
      window.location.reload()
      return new Promise<never>(() => {})
    }
  ))
}

const CreateUserPage     = page(() => import('./pages/CreateUserPage'))
// FIX : ForgotPasswordPage désactivée jusqu'à nouvel ordre (cohérent avec le
// lien caché dans LoginPage.tsx) — décommenter l'import et la route plus bas
// pour réactiver.
// const ForgotPasswordPage = page(() => import('./pages/ForgotPasswordPage'))
const ResetPasswordPage  = page(() => import('./pages/ResetPasswordPage'))
const FormationPage      = page(() => import('./pages/formation/FormationPage'))
const EtudiantPage       = page(() => import('./pages/formation/etudiant/EtudiantPage'))
const LogistiquePage     = page(() => import('./pages/logistique/LogistiquePage'))
const PersonnelPage      = page(() => import('./pages/personnel/PersonnelPage'))
const EtatPage           = page(() => import('./pages/formation/EtatPage'))
const EcheancePage       = page(() => import('./pages/formation/EcheancePage'))
const CertificationPage  = page(() => import('./pages/formation/certification/CertificationPage'))
const ProfilePage        = page(() => import('./pages/ProfilePage'))
const ServicesPage       = page(() => import('./pages/services/ServicesPage'))
const BudgetsPage        = page(() => import('./pages/budgets/BudgetsPage'))
const FacturePage        = page(() => import('./pages/formation/FacturePage'))

// FIX : "token" n'existe plus dans AuthContext depuis le passage à l'auth par
// cookie de session — c'est la présence de "user" qui indique une session active.
//
// FIX PERFORMANCE : on ne bloque plus le rendu des enfants tant que /user n'a
// pas répondu ("loading"). Avant, tant que loading était vrai, la page protégée
// n'était jamais montée dans le DOM — donc ses propres appels API (useTable,
// etc.) ne démarraient qu'APRÈS la résolution de /user, en série. Résultat :
// /user (400-800ms) PUIS achats/charges/etc. (400ms chacune) = 1.5-2s cumulés.
//
// Maintenant on monte les enfants immédiatement : leurs appels API partent en
// parallèle de la vérification /user. Si la session s'avère invalide, on
// redirige dès que "loading" devient false — et de toute façon les requêtes
// de données échoueraient elles-mêmes en 401 (géré par l'intercepteur Axios
// dans api/axios.ts, qui redirige déjà vers /login sur 401/419).
function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (!loading && !user) return <Navigate to="/login" replace />
  return <>{children}</>
}

// PublicRoute inchangée : ce n'est pas elle qui pèse sur la vitesse de
// chargement des données, et elle reste un point sensible (double vérif
// connecté / pas connecté) qu'on ne touche pas ici.
function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-center"><div className="spinner"/></div>
  return !user ? <>{children}</> : <Navigate to="/dashboard" replace />
}

// FIX : nouvelle garde — protège /admin/create-user en plus de l'authentification,
// vérifie aussi que l'utilisateur est bien admin (double protection, cohérent avec
// la vérification déjà faite côté backend dans AuthController::createUser()).
//
// Même optimisation que PrivateRoute : on ne bloque plus le rendu tant que
// loading est vrai.
function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth()
  if (!loading && !user) return <Navigate to="/login" replace />
  if (!loading && user && !isAdmin()) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    // Même indicateur que PublicRoute, le temps de télécharger la page demandée.
    <Suspense fallback={<div className="loading-center"><div className="spinner"/></div>}>
    <Routes>
      {/* ── Pages publiques ── */}
      <Route path="/"                element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
      {/* FIX : route désactivée jusqu'à nouvel ordre — un accès direct à
          l'URL /forgot-password redirige maintenant vers "*" -> "/" comme
          n'importe quelle route inconnue. Décommenter pour réactiver. */}
      {/* <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} /> */}
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
      <Route path="/echeance"      element={<PrivateRoute><EcheancePage /></PrivateRoute>} />
      <Route path="/certification" element={<PrivateRoute><CertificationPage /></PrivateRoute>} />
      <Route path="/profile"       element={<PrivateRoute><ProfilePage /></PrivateRoute>} />

      {/* FIX : Services et Gestion des budgets — réservés admin, wildcard pour sous-routes */}
      <Route path="/services/*" element={<AdminRoute><ServicesPage /></AdminRoute>} />
      <Route path="/budgets/*"  element={<AdminRoute><BudgetsPage /></AdminRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SentinelleSession />
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