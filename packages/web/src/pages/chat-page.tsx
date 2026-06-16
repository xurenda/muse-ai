import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChatComposer } from '@/components/chat/chat-composer'
import { ChatMessageList } from '@/components/chat/chat-message-list'
import { ChatSessionBar } from '@/components/chat/chat-session-bar'
import { Button } from '@/components/ui/button'
import { useChatSessionContext } from '@/context/chat-session-context'
import { useAuth } from '@/hooks/use-auth'
import type { StoredDeviceSession } from '@/lib/config'
import type { SessionSettingsPatch, SessionSettingsResponse } from '@muse-ai/shared'
import type { ChatInputMode } from '@/lib/chat-types'

interface SessionChatFooterProps {
  deviceSession: StoredDeviceSession
  sessionSettings: SessionSettingsResponse | null
  streaming: boolean
  disabled: boolean
  onUpdate: (patch: SessionSettingsPatch) => Promise<boolean>
  onSend: (text: string, mode: ChatInputMode) => void
}

function SessionChatFooter({ deviceSession, sessionSettings, streaming, disabled, onUpdate, onSend }: SessionChatFooterProps) {
  const { auth } = useAuth()
  const [composerText, setComposerText] = useState('')

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-stack">
      <ChatSessionBar deviceSession={deviceSession} sessionSettings={sessionSettings} disabled={disabled} onUpdate={onUpdate} />
      <ChatComposer
        value={composerText}
        onChange={setComposerText}
        streaming={streaming}
        disabled={disabled}
        userToken={auth?.accessToken}
        sessionSettings={sessionSettings}
        onUpdateSessionSettings={onUpdate}
        onSend={onSend}
      />
    </div>
  )
}

export function ChatPage() {
  const { sessionId: routeSessionId } = useParams()
  const { t } = useTranslation('chat')
  const { t: tl } = useTranslation('layout')
  const { deviceSession } = useAuth()
  const {
    status,
    sessionSettings,
    messages,
    streaming,
    connectionError,
    sendError,
    settingsError,
    treeError,
    sendMessage,
    updateSessionSettings,
    startNewSession,
    messagesEndRef,
  } = useChatSessionContext()

  const connectionErrorMessage = connectionError === 'cli_unreachable' ? t('errorCliUnreachable') : connectionError

  if (!deviceSession) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-md text-sm text-muted-foreground">{t('noDeviceHint')}</p>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/devices">{tl('sidebar.devices')}</Link>
        </Button>
      </div>
    )
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {status === 'connecting' ? <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('connecting')}</div> : null}

      {status === 'error' && connectionErrorMessage ? (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="mx-auto block max-w-3xl">{connectionErrorMessage}</span>
        </div>
      ) : null}

      {sendError ? (
        <div className="shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="mx-auto block max-w-3xl">{sendError}</span>
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

      {status === 'ready' ? (
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
              disabled={status !== 'ready'}
              onUpdate={async patch => {
                const result = await updateSessionSettings(patch)
                return result !== null
              }}
              onSend={(text, mode) => void sendMessage(text, mode)}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
