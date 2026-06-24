import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ContextUsagePanel, ContextUsageTrigger } from '@/components/layout/chat-status-bar-context-panel'
import { STATUS_BAR_CONTEXT_SLOT_ID } from '@/constants/status-bar'
import { useChatSessionContext } from '@/context/chat-session-context'
import { formatContextUsageTriggerParts } from '@/lib/format-context-usage-trigger'
import { formatTurnStats } from '@/lib/format-turn-stats'
import { useDeviceStatusStore } from '@/stores/device-status-store'

/** 对话详情页将上下文面板挂载到底部状态栏（模型 Picker 左侧） */
export function ChatStatusBarContextPanel() {
  const { sessionId: routeSessionId } = useParams()
  const { status, sessionSettings, chatContextWindow, canSend, compacting, compactContext, streaming, streamingTurnTokenDisplay, agentStartedAt } =
    useChatSessionContext()
  const [open, setOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const closeDevicePanel = useDeviceStatusStore(state => state.closePanel)

  // streaming 时每秒更新 elapsed
  useEffect(() => {
    if (!streaming || agentStartedAt === null) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      // 延迟一帧避免 effect 体内同步 setState
      const t = setTimeout(() => setElapsed(0), 0)
      return () => clearTimeout(t)
    }
    const startedAt = agentStartedAt
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 500)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [streaming, agentStartedAt])

  const triggerParts = useMemo(
    () => formatContextUsageTriggerParts(sessionSettings?.contextUsage, chatContextWindow),
    [sessionSettings?.contextUsage, chatContextWindow],
  )

  const streamingStatsText = useMemo(() => {
    if (!streaming || elapsed === 0 || streamingTurnTokenDisplay === null) return null
    return formatTurnStats(streamingTurnTokenDisplay, elapsed, true)
  }, [streaming, streamingTurnTokenDisplay, elapsed])

  const handleToggle = useCallback(() => {
    setOpen(value => {
      if (!value) closeDevicePanel()
      return !value
    })
  }, [closeDevicePanel])

  const handleClose = useCallback(() => setOpen(false), [])

  if (!routeSessionId || status !== 'ready') return null

  const slot = document.getElementById(STATUS_BAR_CONTEXT_SLOT_ID)
  if (!slot) return null

  return createPortal(
    <div className="relative flex h-5 items-stretch">
      {open ? (
        <ContextUsagePanel sessionSettings={sessionSettings} compacting={compacting} disabled={!canSend} onCompact={compactContext} onClose={handleClose} />
      ) : null}
      {streamingStatsText ? <span className="flex items-center px-2 text-[11px] tabular-nums text-muted-foreground">{streamingStatsText}</span> : null}
      <ContextUsageTrigger parts={triggerParts} open={open} onToggle={handleToggle} />
    </div>,
    slot,
  )
}
