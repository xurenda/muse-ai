import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { SessionMeta } from '@muse-ai/shared'
import { listSessions } from '@/services/session-api'

export function useSessionList() {
  const { pathname } = useLocation()
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await listSessions()
      setSessions(response.sessions)
      setError(null)
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : String(refreshError)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [pathname, refresh])

  return {
    sessions,
    isLoading,
    error,
    refresh,
  }
}
