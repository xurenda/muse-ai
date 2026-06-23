import { createPortal } from 'react-dom'
import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ContextUsagePanel, ContextUsageTrigger } from '@/components/layout/chat-status-bar-context-panel'
import { STATUS_BAR_CONTEXT_SLOT_ID } from '@/constants/status-bar'
import { useChatSessionContext } from '@/context/chat-session-context'
import { formatContextUsageTriggerParts } from '@/lib/format-context-usage-trigger'
import { useDeviceStatusStore } from '@/stores/device-status-store'

/** 对话详情页将上下文面板挂载到底部状态栏（模型 Picker 左侧） */
export function ChatStatusBarContextPanel() {
  const { sessionId: routeSessionId } = useParams()
  const { status, sessionSettings, chatContextWindow, canSend, compacting, compactContext } = useChatSessionContext()
  const [open, setOpen] = useState(false)
  const closeDevicePanel = useDeviceStatusStore(state => state.closePanel)

  const triggerParts = useMemo(
    () => formatContextUsageTriggerParts(sessionSettings?.contextUsage, chatContextWindow),
    [sessionSettings?.contextUsage, chatContextWindow],
  )

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
      <ContextUsageTrigger parts={triggerParts} open={open} onToggle={handleToggle} />
    </div>,
    slot,
  )
}
