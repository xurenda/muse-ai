import { useCallback, useEffect, useRef, useState } from 'react'
import type { GetSessionTraceResponse, ListSessionTracesResponse } from '@muse-ai/shared'
import { getSessionTrace, listSessionTraces } from '@/services/session-api'

interface UseSessionTracesOptions {
  sessionId?: string
  enabled: boolean
  isSending: boolean
}

interface TraceSummarySnapshot {
  entryCount: number
  updatedAt?: string
}

interface LoadDetailOptions {
  silent?: boolean
}

export function useSessionTraces(options: UseSessionTracesOptions) {
  const { sessionId, enabled, isSending } = options
  const [list, setList] = useState<ListSessionTracesResponse | null>(null)
  const [selectedTurnIndex, setSelectedTurnIndex] = useState<number | null>(null)
  const [detail, setDetail] = useState<GetSessionTraceResponse | null>(null)
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const summarySnapshotRef = useRef<Map<number, TraceSummarySnapshot>>(new Map())

  const refreshList = useCallback(async () => {
    if (!sessionId || !enabled) {
      return
    }

    setIsLoadingList(true)
    try {
      const response = await listSessionTraces(sessionId)
      setList(response)
      setError(null)

      if (response.traces.length === 0) {
        setSelectedTurnIndex(null)
        setDetail(null)
        summarySnapshotRef.current.clear()
        return
      }

      const latestTurn = response.traces[response.traces.length - 1]?.turnIndex
      setSelectedTurnIndex((current) => {
        if (current !== null && response.traces.some((trace) => trace.turnIndex === current)) {
          return current
        }
        return latestTurn ?? null
      })
    } catch (listError) {
      const message = listError instanceof Error ? listError.message : String(listError)
      setError(message)
    } finally {
      setIsLoadingList(false)
    }
  }, [enabled, sessionId])

  const loadDetail = useCallback(
    async (turnIndex: number, loadOptions?: LoadDetailOptions) => {
      if (!sessionId || !enabled) {
        return
      }

      if (!loadOptions?.silent) {
        setIsLoadingDetail(true)
      }

      try {
        const response = await getSessionTrace(sessionId, turnIndex)
        setDetail(response)
        setError(null)
      } catch (detailError) {
        const message = detailError instanceof Error ? detailError.message : String(detailError)
        setError(message)
        if (!loadOptions?.silent) {
          setDetail(null)
        }
      } finally {
        if (!loadOptions?.silent) {
          setIsLoadingDetail(false)
        }
      }
    },
    [enabled, sessionId],
  )

  useEffect(() => {
    if (!enabled || !sessionId) {
      setList(null)
      setDetail(null)
      setSelectedTurnIndex(null)
      setError(null)
      summarySnapshotRef.current.clear()
      return
    }

    void refreshList()
  }, [enabled, refreshList, sessionId])

  useEffect(() => {
    if (!enabled || selectedTurnIndex === null) {
      setDetail(null)
      return
    }

    void loadDetail(selectedTurnIndex)
  }, [enabled, loadDetail, selectedTurnIndex])

  useEffect(() => {
    if (!enabled || !list || selectedTurnIndex === null) {
      return
    }

    const summary = list.traces.find((trace) => trace.turnIndex === selectedTurnIndex)
    if (!summary) {
      return
    }

    const previous = summarySnapshotRef.current.get(selectedTurnIndex)
    summarySnapshotRef.current.set(selectedTurnIndex, {
      entryCount: summary.entryCount,
      updatedAt: summary.updatedAt,
    })

    if (
      previous &&
      (previous.entryCount !== summary.entryCount || previous.updatedAt !== summary.updatedAt)
    ) {
      void loadDetail(selectedTurnIndex, { silent: true })
    }
  }, [enabled, list, loadDetail, selectedTurnIndex])

  useEffect(() => {
    if (!enabled || !sessionId || !isSending) {
      return
    }

    const timer = window.setInterval(() => {
      void refreshList()
    }, 1500)

    return () => {
      window.clearInterval(timer)
    }
  }, [enabled, isSending, refreshList, sessionId])

  useEffect(() => {
    if (!enabled || !sessionId || isSending) {
      return
    }

    void refreshList()
  }, [enabled, isSending, refreshList, sessionId])

  return {
    list,
    detail,
    selectedTurnIndex,
    setSelectedTurnIndex,
    isLoadingList,
    isLoadingDetail,
    error,
    refreshList,
  }
}
