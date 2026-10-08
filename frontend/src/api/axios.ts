import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000/api'

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
  axios.get(`${API_BASE_URL.replace(/\/api\/?$/, '')}/sanctum/csrf-cookie`, {
    withCredentials: true,
  })

export default api