import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { checkCliHealth } from '@/api/backend-client'
import { useAuth } from '@/hooks/use-auth'

const HEALTH_POLL_MS = 30_000

interface DeviceHealthContextValue {
  /** null 表示未选设备或尚未探测 */
  reachable: boolean | null
  checking: boolean
  refresh: () => Promise<void>
}

const DeviceHealthContext = createContext<DeviceHealthContextValue | null>(null)

export function DeviceHealthProvider({ children }: { children: ReactNode }) {
  const { deviceSession } = useAuth()
  const [reachable, setReachable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)

  const refresh = useCallback(async () => {
    if (!deviceSession) {
      setReachable(null)
      setChecking(false)
      return
    }

    setChecking(true)
    try {
      setReachable(await checkCliHealth(deviceSession.endpoint, deviceSession.accessToken))
    } catch {
      setReachable(false)
    } finally {
      setChecking(false)
    }
  }, [deviceSession])

  useEffect(() => {
    let cancelled = false

    const runCheck = () => {
      if (!deviceSession) {
        queueMicrotask(() => {
          if (cancelled) return
          setReachable(null)
          setChecking(false)
        })
        return
      }

      queueMicrotask(() => {
        if (cancelled) return
        setChecking(true)
      })

      void checkCliHealth(deviceSession.endpoint, deviceSession.accessToken)
        .then(result => {
          if (cancelled) return
          setReachable(result)
        })
        .catch(() => {
          if (cancelled) return
          setReachable(false)
        })
        .finally(() => {
          if (cancelled) return
          setChecking(false)
        })
    }

    runCheck()

    if (!deviceSession) {
      return () => {
        cancelled = true
      }
    }

    const intervalId = window.setInterval(runCheck, HEALTH_POLL_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') runCheck()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [deviceSession])

  const value = useMemo(() => ({ reachable, checking, refresh }), [reachable, checking, refresh])

  return <DeviceHealthContext.Provider value={value}>{children}</DeviceHealthContext.Provider>
}

export function useDeviceHealth(): DeviceHealthContextValue {
  const ctx = useContext(DeviceHealthContext)
  if (!ctx) {
    throw new Error('useDeviceHealth 必须在 DeviceHealthProvider 内使用')
  }
  return ctx
}
