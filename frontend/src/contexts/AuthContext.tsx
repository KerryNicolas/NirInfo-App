import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../api/axios'

interface User {
  id: number
  name: string
  email: string
  phone?: string
  role?: string
  matricule?: string
}

interface AuthCtx {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string, password_confirmation: string) => Promise<void>
  logout: () => void
  forgotPassword: (email: string) => Promise<void>
  resetPassword: (data: ResetPasswordData) => Promise<void>
  updateProfile: (data: UpdateProfileData) => Promise<void>
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

const AuthContext = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]     = useState<User | null>(null)
  const [token, setToken]   = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored && token) setUser(JSON.parse(stored))
    setLoading(false)
  }, [token])

  const login = async (email: string, password: string) => {
    const res = await api.post('/login', { email, password })
    const { user, token } = res.data
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setToken(token)
    setUser(user)
  }

  const register = async (
    name: string, email: string,
    password: string, password_confirmation: string
  ) => {
    const res = await api.post('/register', { name, email, password, password_confirmation })
    const { user, token } = res.data
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
    setToken(token)
    setUser(user)
  }

  const logout = async () => {
    try { await api.post('/logout') } catch (_) {}
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const forgotPassword = async (email: string) => {
    await api.post('/forgot-password', { email })
  }

  const resetPassword = async (data: ResetPasswordData) => {
    await api.post('/reset-password', data)
  }

  const updateProfile = async (data: UpdateProfileData) => {
    const res = await api.put('/profile', data)
    const updated = res.data.user
    localStorage.setItem('user', JSON.stringify(updated))
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{
      user, token, login, register, logout,
      forgotPassword, resetPassword, updateProfile,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)