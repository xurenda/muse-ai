import { useCallback, useEffect, useRef, useState } from 'react'
import type { GetSessionTraceResponse } from '@muse-ai/shared'
import { getSessionTrace } from '@/services/session-api'

interface UseSessionTraceOptions {
  sessionId?: string
  enabled: boolean
  isSending: boolean
}

export function useSessionTrace(options: UseSessionTraceOptions) {
  const { sessionId, enabled, isSending } = options
  const [trace, setTrace] = useState<GetSessionTraceResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const etagRef = useRef<string | null>(null)

  const refresh = useCallback(
    async (loadOptions?: { background?: boolean }) => {
      if (!sessionId || !enabled) {
        return
      }

      if (!loadOptions?.background) {
        setIsLoading(true)
      }

      try {
        const result = await getSessionTrace(sessionId, {
          ifNoneMatch: etagRef.current ?? undefined,
        })

        if (result.etag) {
          etagRef.current = result.etag
        }

        if (result.notModified || !result.data) {
          setError(null)
          return
        }

        setTrace(result.data)
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
    [enabled, sessionId],
  )

  useEffect(() => {
    if (!enabled || !sessionId) {
      setTrace(null)
      setError(null)
      etagRef.current = null
      return
    }

    void refresh()
  }, [enabled, refresh, sessionId])

  useEffect(() => {
    if (!enabled || !sessionId || !isSending) {
      return
    }

    const timer = window.setInterval(() => {
      void refresh({ background: true })
    }, 1500)

    return () => {
      window.clearInterval(timer)
    }
  }, [enabled, isSending, refresh, sessionId])

  useEffect(() => {
    if (!enabled || !sessionId || isSending) {
      return
    }

    void refresh()
  }, [enabled, isSending, refresh, sessionId])

  return {
    trace,
    isLoading,
    error,
    refresh,
  }
}
