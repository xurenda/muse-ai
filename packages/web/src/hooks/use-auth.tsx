import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { LoginResponse } from '@muse-ai/shared'
import { SERVER_API_PATHS } from '@muse-ai/shared'
import { AUTH_STORAGE_KEY, DEVICE_SESSION_KEY, backendBaseUrl, type StoredAuth, type StoredDeviceSession } from '@/lib/config'
import i18n from '@/i18n/setup'

/** token 剩余有效期小于等于此值时提前刷新（1 天，单位秒） */
const REFRESH_THRESHOLD_SECONDS = 24 * 60 * 60

interface AuthContextValue {
  auth: StoredAuth | null
  deviceSession: StoredDeviceSession | null
  setAuth: (value: StoredAuth | null) => void
  setDeviceSession: (value: StoredDeviceSession | null) => void
  /**
   * 登出：清除本地凭证并跳转到登录页。
   * @param reason 若传入，会在跳转后弹出 toast 提示原因（如「令牌过期，请重新登录」）
   */
  logout: (reason?: string) => void
  /**
   * 返回当前有效的 access token。
   * 若 token 剩余有效期 ≤ 1d，自动用 refresh token 换取新 token 后返回。
   * 若刷新失败（refresh token 过期/无效），触发 logout 并抛出异常。
   */
  getValidAccessToken: () => Promise<string>
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
  /** 防止并发刷新：正在刷新时复用同一个 Promise */
  const refreshingRef = useRef<Promise<string> | null>(null)
  const navigate = useNavigate()

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

  const logout = useCallback(
    (reason?: string) => {
      // 清除所有本地凭证
      setAuth(null)
      setDeviceSession(null)
      // 跳转登录页，replace 避免返回时回到需鉴权的页面
      navigate('/login', { replace: true })
      // 若有原因（如 token 过期），延迟一帧再弹 toast，确保页面已切换
      if (reason) {
        setTimeout(() => toast.error(reason), 0)
      }
    },
    [navigate, setAuth, setDeviceSession],
  )

  const getValidAccessToken = useCallback(async (): Promise<string> => {
    const current = auth
    if (!current) {
      logout(i18n.t('auth:tokenExpired'))
      throw new Error('未登录')
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    const remaining = current.accessTokenExpiresAt - nowSeconds

    // token 还有超过 1d 有效期，直接返回
    if (remaining > REFRESH_THRESHOLD_SECONDS) {
      return current.accessToken
    }

    // 已有刷新请求在飞，等待同一个 Promise 避免并发
    if (refreshingRef.current) {
      return refreshingRef.current
    }

    const doRefresh = async (): Promise<string> => {
      try {
        const res = await fetch(`${backendBaseUrl}${SERVER_API_PATHS.AUTH_REFRESH}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        })
        if (!res.ok) {
          throw new Error('refresh token 已失效')
        }
        const data = (await res.json()) as LoginResponse
        const next: StoredAuth = {
          accessToken: data.accessToken,
          accessTokenExpiresAt: data.accessTokenExpiresAt,
          refreshToken: data.refreshToken,
          user: data.user,
        }
        setAuth(next)
        return data.accessToken
      } catch {
        // refresh 失败：清除凭证、跳转登录页、toast 提示
        const msg = i18n.t('auth:tokenExpired')
        logout(msg)
        throw new Error(msg)
      } finally {
        refreshingRef.current = null
      }
    }

    refreshingRef.current = doRefresh()
    return refreshingRef.current
  }, [auth, setAuth, logout])

  const value = useMemo(
    () => ({ auth, deviceSession, setAuth, setDeviceSession, logout, getValidAccessToken }),
    [auth, deviceSession, setAuth, setDeviceSession, logout, getValidAccessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return ctx
}

export function loginResponseToStored(response: LoginResponse): StoredAuth {
  return {
    accessToken: response.accessToken,
    accessTokenExpiresAt: response.accessTokenExpiresAt,
    refreshToken: response.refreshToken,
    user: response.user,
  }
}
