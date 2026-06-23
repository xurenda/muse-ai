import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChatComposer } from '@/components/chat/chat-composer'
import { ChatMessageList } from '@/components/chat/chat-message-list'
import { NoDeviceGuide } from '@/components/chat/no-device-guide'
import { Button } from '@/components/ui/button'
import { useChatSessionContext } from '@/context/chat-session-context'
import { useAuth } from '@/hooks/use-auth'
import type { StoredDeviceSession } from '@/lib/config'
import type { SessionSettingsPatch, SessionSettingsResponse } from '@muse-ai/shared'
import type { ChatInputMode } from '@/lib/chat-types'
import { useCallback, useState } from 'react'

interface SessionChatFooterProps {
  deviceSession: StoredDeviceSession
  sessionSettings: SessionSettingsResponse | null
  streaming: boolean
  disabled: boolean
  canStop: boolean
  stopping: boolean
  compacting: boolean
  initialText?: string
  onUpdate: (patch: SessionSettingsPatch) => Promise<boolean>
  onSend: (text: string, mode: ChatInputMode) => void
  onStop: () => void
}

function SessionChatFooter({
  deviceSession,
  sessionSettings,
  streaming,
  disabled,
  canStop,
  stopping,
  compacting,
  initialText,
  onUpdate,
  onSend,
  onStop,
}: SessionChatFooterProps) {
  const [composerText, setComposerText] = useState(initialText ?? '')

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-stack">
      <ChatComposer
        value={composerText}
        onChange={setComposerText}
        streaming={streaming}
        compacting={compacting}
        disabled={disabled}
        canStop={canStop}
        stopping={stopping}
        deviceSession={deviceSession}
        sessionSettings={sessionSettings}
        onUpdateSession={onUpdate}
        onSend={onSend}
        onStop={onStop}
      />
    </div>
  )
}

export function ChatPage() {
  const { sessionId: routeSessionId } = useParams()
  const { t } = useTranslation('chat')
  const { deviceSession } = useAuth()
  const {
    status,
    sessionSettings,
    messages,
    streaming,
    canSend,
    canStop,
    stopping,
    sendError,
    settingsError,
    treeError,
    compacting,
    sendMessage,
    retryFromMessage,
    stopGeneration,
    updateSessionSettings,
    startNewSession,
    messagesEndRef,
  } = useChatSessionContext()

  // 编辑或重新生成时用于重置输入框初始内容（必须在所有条件 return 之前）
  const [footerKey, setFooterKey] = useState(0)
  const [footerInitialText, setFooterInitialText] = useState<string | undefined>(undefined)

  const handleRetry = useCallback(
    (userMessageId: string, text: string) => {
      // 重新生成：navigate 到前一个节点，然后发送原文本
      void retryFromMessage(userMessageId, text)
    },
    [retryFromMessage],
  )

  const handleEdit = useCallback(
    (userMessageId: string, currentText: string) => {
      // 编辑：只 navigate（不传 sendAfter），回填输入框
      void retryFromMessage(userMessageId)
      setFooterInitialText(currentText)
      setFooterKey(k => k + 1)
    },
    [retryFromMessage],
  )

  if (!deviceSession) {
    return <NoDeviceGuide />
  }

  if (!routeSessionId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">{t('newChatHint')}</p>
        <Button type="button" onClick={() => void startNewSession()}>
          {t('startNewSession')}
        </Button>
      </div>
    )
  }

  const showChatContent = status === 'ready'
  const composerDisabled = !canSend

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {status === 'connecting' ? <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('connecting')}</div> : null}

      {sendError ? (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="mx-auto block max-w-3xl">{t('errorSendFailed', { message: sendError })}</span>
        </div>
      ) : null}
      {settingsError ? (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="mx-auto block max-w-3xl">{settingsError}</span>
        </div>
      ) : null}
      {treeError ? (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="mx-auto block max-w-3xl">{treeError}</span>
        </div>
      ) : null}

      {showChatContent ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
            <div className="mx-auto flex w-full max-w-3xl flex-col">
              <ChatMessageList messages={messages} messagesEndRef={messagesEndRef} streaming={streaming} onRetry={handleRetry} onEdit={handleEdit} />
            </div>
          </div>

          <div className="shrink-0 px-page-x pb-panel-y pt-stack">
            <SessionChatFooter
              key={`${routeSessionId}-${footerKey}`}
              deviceSession={deviceSession}
              sessionSettings={sessionSettings}
              streaming={streaming}
              disabled={composerDisabled}
              canStop={canStop}
              stopping={stopping}
              compacting={compacting}
              initialText={footerInitialText}
              onUpdate={async patch => {
                const result = await updateSessionSettings(patch)
                return result !== null
              }}
              onSend={(text, mode) => void sendMessage(text, mode)}
              onStop={() => void stopGeneration()}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
