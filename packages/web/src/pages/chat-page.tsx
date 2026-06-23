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
import { useState } from 'react'

interface SessionChatFooterProps {
  deviceSession: StoredDeviceSession
  sessionSettings: SessionSettingsResponse | null
  streaming: boolean
  disabled: boolean
  canStop: boolean
  stopping: boolean
  compacting: boolean
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
  onUpdate,
  onSend,
  onStop,
}: SessionChatFooterProps) {
  const [composerText, setComposerText] = useState('')

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
    stopGeneration,
    updateSessionSettings,
    startNewSession,
    messagesEndRef,
  } = useChatSessionContext()

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
              <ChatMessageList messages={messages} messagesEndRef={messagesEndRef} />
            </div>
          </div>

          <div className="shrink-0 px-page-x pb-panel-y pt-stack">
            <SessionChatFooter
              key={routeSessionId}
              deviceSession={deviceSession}
              sessionSettings={sessionSettings}
              streaming={streaming}
              disabled={composerDisabled}
              canStop={canStop}
              stopping={stopping}
              compacting={compacting}
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
