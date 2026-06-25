import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { SessionMeta } from '@museai/shared'
import { listCliSessions } from '@/api/cli-client'
import { useAuth } from '@/hooks/use-auth'
import { useDeviceHealth } from '@/hooks/use-device-health'
import { mergeSessionList } from '@/lib/merge-session-list'
import { useSessionListStore } from '@/stores/session-list-store'

export function useSessionList() {
  const { deviceSession } = useAuth()
  const { reachable } = useDeviceHealth()
  const { pathname } = useLocation()
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const patches = useSessionListStore(state => state.patches)
  const clearPatches = useSessionListStore(state => state.clearPatches)
  const refreshNonce = useSessionListStore(state => state.refreshNonce)
  const requestRefresh = useSessionListStore(state => state.requestRefresh)
  const prevReachableRef = useRef<boolean | null>(null)

  const mergedSessions = useMemo(() => mergeSessionList(sessions, patches), [sessions, patches])

  const refresh = useCallback(async () => {
    if (!deviceSession) {
      setSessions([])
      setError(null)
      setIsLoading(false)
      clearPatches()
      return
    }

    setIsLoading(true)
    try {
      clearPatches()
      setSessions(await listCliSessions(deviceSession.endpoint, deviceSession.accessToken))
      setError(null)
    } catch (refreshError: unknown) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError))
    } finally {
      setIsLoading(false)
    }
  }, [clearPatches, deviceSession])

  // Web→CLI 恢复可达后重拉列表，清除断线期间的 Failed to fetch
  useEffect(() => {
    const prev = prevReachableRef.current
    prevReachableRef.current = reachable
    if (prev === false && reachable === true) {
      requestRefresh()
    }
  }, [reachable, requestRefresh])

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
        clearPatches()
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
  }, [clearPatches, deviceSession, pathname, refreshNonce])

  return {
    sessions: mergedSessions,
    isLoading,
    error,
    refresh,
  }
}
