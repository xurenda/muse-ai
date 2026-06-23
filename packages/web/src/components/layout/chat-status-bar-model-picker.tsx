import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { ChatModelPicker } from '@/components/chat/chat-model-picker'
import { STATUS_BAR_TRAILING_SLOT_ID } from '@/constants/status-bar'
import { useChatSessionContext } from '@/context/chat-session-context'
import { useAuth } from '@/hooks/use-auth'

/** 对话详情页将模型选择器挂载到底部状态栏右侧 */
export function ChatStatusBarModelPicker() {
  const { sessionId: routeSessionId } = useParams()
  const { getValidAccessToken } = useAuth()
  const { status, sessionSettings, chatModelDisplay, canSend, updateSessionSettings } = useChatSessionContext()

  if (!routeSessionId || status !== 'ready') return null

  const slot = document.getElementById(STATUS_BAR_TRAILING_SLOT_ID)
  if (!slot) return null

  return createPortal(
    <ChatModelPicker
      statusBar
      getValidAccessToken={getValidAccessToken}
      sessionSettings={sessionSettings}
      chatModelDisplay={chatModelDisplay}
      disabled={!canSend}
      onUpdate={async patch => {
        const result = await updateSessionSettings(patch)
        return result !== null
      }}
    />,
    slot,
  )
}
