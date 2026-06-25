import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import type { SessionSettingsResponse } from '@museai/shared'
import { ChatModelPicker } from '@/components/chat/chat-model-picker'
import { STATUS_BAR_TRAILING_SLOT_ID } from '@/constants/status-bar'
import { useChatSessionContext } from '@/context/chat-session-context'
import { useAuth } from '@/hooks/use-auth'

/** 对话页（/chat 与 /chat/:id）将模型选择器挂载到底部状态栏右侧 */
export function ChatStatusBarModelPicker() {
  const { sessionId: routeSessionId } = useParams()
  const { getValidAccessToken, deviceSession } = useAuth()
  const { status, sessionSettings, chatModelDisplay, canSend, updateSessionSettings, newChatDraft, updateNewChatDraft, deviceUnreachable, creatingSession } =
    useChatSessionContext()

  const isNewChat = !routeSessionId

  const pickerSessionSettings = useMemo((): SessionSettingsResponse | null => {
    if (!isNewChat) return sessionSettings
    return {
      thinkingLevel: newChatDraft.thinkingLevel ?? 'off',
      modelSelection: newChatDraft.modelSelection,
    } as SessionSettingsResponse
  }, [isNewChat, newChatDraft.modelSelection, newChatDraft.thinkingLevel, sessionSettings])

  if (!deviceSession) return null
  if (!isNewChat && status !== 'ready') return null

  const slot = document.getElementById(STATUS_BAR_TRAILING_SLOT_ID)
  if (!slot) return null

  const disabled = isNewChat ? deviceUnreachable || creatingSession : !canSend

  return createPortal(
    <ChatModelPicker
      statusBar
      getValidAccessToken={getValidAccessToken}
      sessionSettings={pickerSessionSettings}
      chatModelDisplay={isNewChat ? undefined : chatModelDisplay}
      disabled={disabled}
      onUpdate={async patch => {
        if (isNewChat) {
          updateNewChatDraft(patch)
          return true
        }
        const result = await updateSessionSettings(patch)
        return result !== null
      }}
    />,
    slot,
  )
}
