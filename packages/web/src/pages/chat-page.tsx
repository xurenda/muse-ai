import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChatComposer } from '@/components/chat/chat-composer'
import { ChatMessageList } from '@/components/chat/chat-message-list'
import { ChatScrollControls } from '@/components/chat/chat-scroll-controls'
import { NoDeviceGuide } from '@/components/chat/no-device-guide'
import { useChatSessionContext } from '@/context/chat-session-context'
import { useAuth } from '@/hooks/use-auth'
import { useChatAutoScroll } from '@/hooks/use-chat-auto-scroll'
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

interface NewChatLandingProps {
  deviceSession: StoredDeviceSession
  disabled: boolean
  onSend: (text: string, mode: ChatInputMode, agentId?: string) => void
}

function NewChatLanding({ deviceSession, disabled, onSend }: NewChatLandingProps) {
  const [composerText, setComposerText] = useState('')
  const [draftAgentId, setDraftAgentId] = useState<string | undefined>()
  const draftSessionSettings: SessionSettingsResponse | null = draftAgentId ? ({ agentId: draftAgentId } as SessionSettingsResponse) : null

  const handleSend = useCallback(
    (text: string, mode: ChatInputMode) => {
      onSend(text, mode, draftAgentId)
    },
    [draftAgentId, onSend],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-page-x pb-panel-y">
      <div className="mx-auto w-full max-w-3xl">
        <ChatComposer
          value={composerText}
          onChange={setComposerText}
          streaming={false}
          compacting={false}
          disabled={disabled}
          canStop={false}
          stopping={false}
          prominent
          autoFocus
          deviceSession={deviceSession}
          sessionSettings={draftSessionSettings}
          onUpdateSession={async patch => {
            if (patch.agentId) setDraftAgentId(patch.agentId)
            return true
          }}
          onSend={handleSend}
          onStop={() => {}}
        />
      </div>
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
    creatingSession,
    deviceUnreachable,
    sendMessage,
    retryFromMessage,
    stopGeneration,
    updateSessionSettings,
    startNewSessionWithMessage,
  } = useChatSessionContext()

  const { scrollContainerRef, bottomSentinelRef, footerResizeTargetRef, isAtBottom, isAtTop, scrollToBottom, scrollToTop, resumeFollowing, scrollToMessage } =
    useChatAutoScroll({
      contentDeps: [messages, streaming],
      resetKey: routeSessionId,
      streaming,
    })

  const footerKey = 0
  const footerInitialText = undefined

  const handleRetry = useCallback(
    (userMessageId: string, text: string) => {
      resumeFollowing()
      // 重新生成：navigate 到前一个节点，然后发送原文本
      void retryFromMessage(userMessageId, text)
    },
    [retryFromMessage, resumeFollowing],
  )

  const handleSend = useCallback(
    (text: string, mode: ChatInputMode) => {
      resumeFollowing()
      void sendMessage(text, mode)
    },
    [sendMessage, resumeFollowing],
  )

  const handleNewChatSend = useCallback(
    (text: string, mode: ChatInputMode, agentId?: string) => {
      void startNewSessionWithMessage(text, mode, agentId)
    },
    [startNewSessionWithMessage],
  )

  if (!deviceSession) {
    return <NoDeviceGuide />
  }

  if (!routeSessionId) {
    return <NewChatLanding deviceSession={deviceSession} disabled={deviceUnreachable || creatingSession} onSend={handleNewChatSend} />
  }

  const showChatContent = status === 'ready'
  const composerDisabled = !canSend

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-clip">
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
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div ref={scrollContainerRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
              <div className="mx-auto flex w-full max-w-3xl flex-col">
                <ChatMessageList messages={messages} bottomSentinelRef={bottomSentinelRef} streaming={streaming} onRetry={handleRetry} />
              </div>
            </div>

            <ChatScrollControls
              messages={messages}
              scrollContainerRef={scrollContainerRef}
              isAtBottom={isAtBottom}
              isAtTop={isAtTop}
              resetKey={routeSessionId}
              onScrollToBottom={scrollToBottom}
              onScrollToTop={scrollToTop}
              onScrollToMessage={scrollToMessage}
            />
          </div>

          <div ref={footerResizeTargetRef} className="shrink-0 px-page-x pb-panel-y pt-stack">
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
              onSend={handleSend}
              onStop={() => void stopGeneration()}
            />
          </div>
        </>
      ) : null}
    </div>
  )
}
