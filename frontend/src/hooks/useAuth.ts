import { useState } from 'react'
import api from '@/lib/api'

export interface User {
  id: string
  name: string
  username: string
  role: 'ADMIN' | 'ENGINEER' | 'SALESPERSON'
  avatarColor: string
  defaultRiskMargin: number
  defaultProfitMargin: number
  defaultTaxRate: number
  defaultSteelType: string
  defaultPolishLevel: string
  defaultCavities: number
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('nf_user')
    return stored ? JSON.parse(stored) : null
  })
  const [loading, setLoading] = useState(false)

  async function login(username: string, password: string) {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', { username, password })
      localStorage.setItem('nf_token', data.token)
      localStorage.setItem('nf_refresh_token', data.refreshToken)
      localStorage.setItem('nf_user', JSON.stringify(data.user))
      setUser(data.user)
      return data.user
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('nf_token')
    localStorage.removeItem('nf_refresh_token')
    localStorage.removeItem('nf_user')
    setUser(null)
  }

  function updateUser(partial: Partial<User>) {
    if (!user) return
    const updated = { ...user, ...partial }
    localStorage.setItem('nf_user', JSON.stringify(updated))
    setUser(updated)
  }

  return { user, loading, login, logout, updateUser }
}
