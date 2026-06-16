import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { SessionMeta } from '@muse-ai/shared'
import { listCliSessions } from '@/api/cli-client'
import { useAuth } from '@/hooks/use-auth'

export function useSessionList() {
  const { deviceSession } = useAuth()
  const { pathname } = useLocation()
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!deviceSession) {
      setSessions([])
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      setSessions(await listCliSessions(deviceSession.endpoint, deviceSession.accessToken))
      setError(null)
    } catch (refreshError: unknown) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError))
    } finally {
      setIsLoading(false)
    }
  }, [deviceSession])

  useEffect(() => {
    let cancelled = false

    if (!deviceSession) {
      queueMicrotask(() => {
        if (cancelled) return
        setSessions([])
        setError(null)
        setIsLoading(false)
      })
      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (cancelled) return
      setIsLoading(true)
    })

    void listCliSessions(deviceSession.endpoint, deviceSession.accessToken)
      .then(list => {
        if (cancelled) return
        setSessions(list)
        setError(null)
      })
      .catch((refreshError: unknown) => {
        if (cancelled) return
        setError(refreshError instanceof Error ? refreshError.message : String(refreshError))
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [deviceSession, pathname])

  return {
    sessions,
    isLoading,
    error,
    refresh,
  }
}
