import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { LoginResponse } from '@muse-ai/shared'
import { AUTH_STORAGE_KEY, DEVICE_SESSION_KEY, type StoredAuth, type StoredDeviceSession } from '@/lib/config'

interface AuthContextValue {
  auth: StoredAuth | null
  deviceSession: StoredDeviceSession | null
  setAuth: (value: StoredAuth | null) => void
  setDeviceSession: (value: StoredDeviceSession | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredAuth
  } catch {
    return null
  }
}

function readStoredDeviceSession(): StoredDeviceSession | null {
  const raw = localStorage.getItem(DEVICE_SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredDeviceSession
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<StoredAuth | null>(() => readStoredAuth())
  const [deviceSession, setDeviceSessionState] = useState<StoredDeviceSession | null>(() => readStoredDeviceSession())

  const setAuth = useCallback((value: StoredAuth | null) => {
    setAuthState(value)
    if (value) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value))
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY)
    }
  }, [])

  const setDeviceSession = useCallback((value: StoredDeviceSession | null) => {
    setDeviceSessionState(value)
    if (value) {
      localStorage.setItem(DEVICE_SESSION_KEY, JSON.stringify(value))
    } else {
      localStorage.removeItem(DEVICE_SESSION_KEY)
    }
  }, [])

  const logout = useCallback(() => {
    setAuth(null)
    setDeviceSession(null)
  }, [setAuth, setDeviceSession])

  const value = useMemo(() => ({ auth, deviceSession, setAuth, setDeviceSession, logout }), [auth, deviceSession, setAuth, setDeviceSession, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}

export function loginResponseToStored(response: LoginResponse): StoredAuth {
  return { accessToken: response.accessToken, user: response.user }
}
