import { useCallback, useEffect, useRef, useState } from 'react'
import type { GetSessionLlmInspectResponse } from '@museai/shared'
import { getSessionLlmInspect } from '@/api/cli-client'

interface UseSessionLlmInspectOptions {
  endpoint: string | null
  accessToken: string | null
  sessionId?: string
  enabled: boolean
  isStreaming: boolean
}

export function useSessionLlmInspect(options: UseSessionLlmInspectOptions) {
  const { endpoint, accessToken, sessionId, enabled, isStreaming } = options
  const [inspect, setInspect] = useState<GetSessionLlmInspectResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const etagRef = useRef<string | null>(null)
  const prevStreamingRef = useRef(isStreaming)

  const refresh = useCallback(
    async (loadOptions?: { background?: boolean }) => {
      if (!endpoint || !accessToken || !sessionId || !enabled) {
        return
      }

      if (!loadOptions?.background) {
        setIsLoading(true)
      }

      try {
        const result = await getSessionLlmInspect(endpoint, accessToken, sessionId, {
          ifNoneMatch: etagRef.current ?? undefined,
        })

        if (result.etag) {
          etagRef.current = result.etag
        }

        if (result.notModified || !result.data) {
          setError(null)
          return
        }

        setInspect(result.data)
        setError(null)
      } catch (refreshError) {
        const message = refreshError instanceof Error ? refreshError.message : String(refreshError)
        setError(message)
      } finally {
        if (!loadOptions?.background) {
          setIsLoading(false)
        }
      }
    },
    [accessToken, enabled, endpoint, sessionId],
  )

  useEffect(() => {
    let cancelled = false

    if (!enabled || !sessionId || !endpoint || !accessToken) {
      queueMicrotask(() => {
        if (cancelled) return
        setInspect(null)
        setError(null)
        setIsLoading(false)
        etagRef.current = null
      })
      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (cancelled) return
      setIsLoading(true)
    })

    void getSessionLlmInspect(endpoint, accessToken, sessionId, {
      ifNoneMatch: etagRef.current ?? undefined,
    })
      .then(result => {
        if (cancelled) return

        if (result.etag) {
          etagRef.current = result.etag
        }

        if (result.notModified || !result.data) {
          setError(null)
          return
        }

        setInspect(result.data)
        setError(null)
      })
      .catch(refreshError => {
        if (cancelled) return
        const message = refreshError instanceof Error ? refreshError.message : String(refreshError)
        setError(message)
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, enabled, endpoint, sessionId])

  useEffect(() => {
    if (!enabled || !sessionId || !endpoint || !accessToken || !isStreaming) {
      return
    }

    const timer = window.setInterval(() => {
      void refresh({ background: true })
    }, 1500)

    return () => {
      window.clearInterval(timer)
    }
  }, [accessToken, enabled, endpoint, isStreaming, refresh, sessionId])

  useEffect(() => {
    const wasStreaming = prevStreamingRef.current
    prevStreamingRef.current = isStreaming

    if (wasStreaming && !isStreaming && enabled && sessionId && endpoint && accessToken) {
      queueMicrotask(() => {
        void refresh()
      })
    }
  }, [accessToken, enabled, endpoint, isStreaming, refresh, sessionId])

  return {
    inspect,
    isLoading,
    error,
    refresh,
  }
}
