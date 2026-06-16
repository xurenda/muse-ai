import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/language-switcher'
import { ChatInput } from '@/components/chat/chat-input'
import { ChatMessageList } from '@/components/chat/chat-message-list'
import { ChatSessionBar } from '@/components/chat/chat-session-bar'
import { SessionSidebar } from '@/components/chat/session-sidebar'
import { SessionTreePanel } from '@/components/chat/session-tree-panel'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useChatSession } from '@/hooks/use-chat-session'

export function ChatPage() {
  const { t } = useTranslation('chat')
  const { t: ta } = useTranslation('auth')
  const { t: tc } = useTranslation('common')
  const { deviceSession, logout } = useAuth()
  const {
    status,
    sessionId,
    sessions,
    sessionTree,
    sessionSettings,
    messages,
    streaming,
    connectionError,
    sendError,
    settingsError,
    treeError,
    sendMessage,
    updateSessionSettings,
    selectSession,
    newSession,
    navigateToEntry,
    forkFromEntry,
    messagesEndRef,
  } = useChatSession(deviceSession)

  const connectionErrorMessage = connectionError === 'cli_unreachable' ? t('errorCliUnreachable') : connectionError

  if (!deviceSession) return null

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">{t('title')}</h1>
          <p className="text-xs text-muted-foreground">{t('connectedDevice', { name: deviceSession.deviceName })}</p>
          {sessionId ? <p className="font-mono text-[10px] text-muted-foreground/70">{sessionId}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LanguageSwitcher />
          <Button type="button" variant="outline" size="sm" onClick={() => void newSession()} disabled={status !== 'ready'}>
            {t('newSession')}
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/devices">{tc('back')}</Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={logout}>
            {ta('logout')}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <SessionSidebar
          sessions={sessions}
          activeSessionId={sessionId}
          disabled={status !== 'ready'}
          onSelect={id => void selectSession(id)}
          onNew={() => void newSession()}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {status === 'ready' ? (
            <ChatSessionBar
              deviceSession={deviceSession}
              sessionSettings={sessionSettings}
              disabled={status !== 'ready'}
              onUpdate={async patch => {
                const result = await updateSessionSettings(patch)
                return result !== null
              }}
            />
          ) : null}

          {status === 'connecting' ? <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{t('connecting')}</div> : null}

          {status === 'error' && connectionErrorMessage ? (
            <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{connectionErrorMessage}</div>
          ) : null}

          {sendError ? <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{sendError}</div> : null}
          {settingsError ? <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{settingsError}</div> : null}
          {treeError ? <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{treeError}</div> : null}

          {status === 'ready' ? (
            <>
              <ChatMessageList messages={messages} messagesEndRef={messagesEndRef} />
              <ChatInput streaming={streaming} disabled={status !== 'ready'} onSend={(text, mode) => void sendMessage(text, mode)} />
            </>
          ) : null}
        </div>

        <SessionTreePanel
          tree={sessionTree}
          disabled={status !== 'ready' || streaming}
          onNavigate={entryId => void navigateToEntry(entryId)}
          onFork={entryId => void forkFromEntry(entryId)}
        />
      </div>
    </div>
  )
}
