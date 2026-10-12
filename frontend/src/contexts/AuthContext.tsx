import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import api, { getCsrfCookie } from '../api/axios'

interface User {
  id: number
  name: string
  email: string
  phone?: string
  role?: string
  role_slug?: string
  permissions?: string[]
  matricule?: string
  // Adresse de la photo de profil ; absente = afficher les initiales.
  photo_url?: string | null
}

interface AuthCtx {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (data: ResetPasswordData) => Promise<void>
  activateAccount: (data: ResetPasswordData) => Promise<void>
  updateProfile: (data: UpdateProfileData) => Promise<void>
  uploadPhoto: (file: File) => Promise<void>
  removePhoto: () => Promise<void>
  hasPermission: (slug: string) => boolean
  isAdmin: () => boolean
  loading: boolean
}

interface ResetPasswordData {
  token: string
  email: string
  password: string
  password_confirmation: string
}

interface UpdateProfileData {
  name?: string
  email?: string
  phone?: string
  current_password?: string
  password?: string
  password_confirmation?: string
}

// Durée d'inactivité avant déconnexion automatique — 30 minutes
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']

const AuthContext = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.get('/user')
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    await getCsrfCookie()
    const res = await api.post('/login', { email, password })
    setUser(res.data.user)
  }

  const logout = async () => {
    try { await api.post('/logout') } catch (_) {}
    setUser(null)
  }

  // ── Déconnexion automatique sur inactivité ──
  useEffect(() => {
    if (!user) return

    const resetIdleTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => {
        logout()
      }, IDLE_TIMEOUT_MS)
    }

    resetIdleTimer()
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetIdleTimer))

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetIdleTimer))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const forgotPassword = async (email: string) => {
    await api.post('/forgot-password', { email })
  }

  const resetPassword = async (data: ResetPasswordData) => {
    await api.post('/reset-password', data)
  }

  // Activation d'un compte créé par l'admin (lien reçu par email) : même
  // forme de données que resetPassword, mais route dédiée — le backend refuse
  // /reset-password tant que le compte n'est pas activé.
  const activateAccount = async (data: ResetPasswordData) => {
    await api.post('/activate-account', data)
  }

  const updateProfile = async (data: UpdateProfileData) => {
    const res = await api.put('/profile', data)
    setUser(res.data.user)
  }

  // Photo de profil du compte connecté (le serveur ne connaît que celle-là).
  const uploadPhoto = async (file: File) => {
    const fd = new FormData(); fd.append('photo', file)
    const res = await api.post('/profile/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    setUser(res.data.user)
  }

  const removePhoto = async () => {
    const res = await api.post('/profile/photo/retirer')
    setUser(res.data.user)
  }

  const hasPermission = (slug: string): boolean => {
    return user?.permissions?.includes(slug) ?? false
  }

  // Administrateur au sens large : admin secondaire OU administrateur
  // principal (super-admin) — même règle que User::isAdmin() côté serveur.
  const isAdmin = (): boolean => {
    return user?.role_slug === 'admin' || user?.role_slug === 'super-admin'
  }

  return (
    <AuthContext.Provider value={{
      user, login, logout,
      forgotPassword, resetPassword, activateAccount, updateProfile,
      uploadPhoto, removePhoto,
      hasPermission, isAdmin,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)