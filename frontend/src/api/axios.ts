import axios from 'axios'

// FIX : l'adresse de l'API n'est plus écrite en dur — elle vient de
// VITE_API_URL (frontend/.env). Sans cette variable, on garde l'adresse locale
// habituelle. Avant, VITE_API_URL existait mais n'était lue nulle part :
// l'application ne pouvait tourner que sur le poste du développeur.
const API_BASE_URL: string = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

// Racine du serveur Laravel (sans /api) : sert au cookie CSRF et aux fichiers.
const API_ROOT_URL = API_BASE_URL.replace(/\/api\/?$/, '')

// Adresse publique d'un fichier envoyé (photo…) à partir du chemin stocké en
// base, ex. "personnels/abc.jpg" -> "<serveur>/storage/personnels/abc.jpg".
export const storageUrl = (path: string) => `${API_ROOT_URL}/storage/${path}`

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
  withCredentials: true,
})

// FIX : Axios n'attache pas toujours automatiquement X-XSRF-TOKEN sur des requêtes
// cross-origin (localhost:5173 -> localhost:8000 = origines différentes pour le
// navigateur, même sur "localhost"). On le fait nous-mêmes, en lisant le cookie
// XSRF-TOKEN (non-httpOnly, donc lisible en JS) posé par /sanctum/csrf-cookie.
function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[2]) : null
}

api.interceptors.request.use((config) => {
  const xsrfToken = readCookie('XSRF-TOKEN')
  if (xsrfToken) {
    config.headers['X-XSRF-TOKEN'] = xsrfToken
  }
  return config
})

// Intercepteur réponse — gère à la fois 401 (session absente/expirée) et 419
// (jeton CSRF expiré, typique après une longue inactivité) : dans les deux cas,
// l'utilisateur n'est plus authentifié valablement, on le renvoie proprement au login.
//
// FIX : pas de redirection sur les pages publiques. Au chargement, AuthContext
// appelle /user pour savoir si quelqu'un est connecté : pour un visiteur non
// connecté, le 401 est la réponse normale, pas une session expirée. Avant, ce
// 401 expulsait vers /login toute personne ouvrant /reset-password — le lien
// d'activation de compte et celui de réinitialisation étaient inutilisables.
const PUBLIC_PATHS = ['/', '/login', '/reset-password', '/forgot-password']

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status
    if (status === 401 || status === 419) {
      if (!PUBLIC_PATHS.includes(window.location.pathname)) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// Appel CSRF Sanctum — hors du préfixe /api, requête séparée avec l'URL racine.
export const getCsrfCookie = () =>
  axios.get(`${API_ROOT_URL}/sanctum/csrf-cookie`, {
    withCredentials: true,
  })

export default api