import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { TracePanel } from '@/components/chat/trace-panel'
import { resolveRightSidebarActions } from '@/constants/right-sidebar-actions'
import { useChatSessionRuntimeStore } from '@/stores/chat-session-runtime'
import { useRightSidebarPanelStore } from '@/stores/right-sidebar-panel'

export function RightSidebarContent() {
  const { pathname } = useLocation()
  const { sessionId } = useParams()
  const activePanel = useRightSidebarPanelStore((state) => state.activePanel)
  const closePanel = useRightSidebarPanelStore((state) => state.closePanel)
  const isSending = useChatSessionRuntimeStore((state) => state.isSending)

  useEffect(() => {
    const actions = resolveRightSidebarActions(pathname)
    if (!activePanel || !actions.some((action) => action.id === activePanel)) {
      closePanel()
    }
  }, [activePanel, closePanel, pathname])

  if (activePanel === 'trace' && sessionId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <TracePanel sessionId={sessionId} isSending={isSending} onClose={closePanel} />
      </div>
    )
  }

  return null
}
