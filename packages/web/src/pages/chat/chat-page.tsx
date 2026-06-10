import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChatComposer } from '@/components/chat/chat-composer'
import { ChatViewList } from '@/components/chat/chat-view-list'
import { PlanningIndicator } from '@/components/chat/planning-indicator'
import { useChatSession, type SessionMessageDelivery } from '@/hooks/use-chat-session'
import { useStickToBottom } from '@/hooks/use-stick-to-bottom'
import { useTranslation } from '@/hooks/use-translation'

export function ChatPage() {
  const { t } = useTranslation('chat')
  const navigate = useNavigate()
  const { sessionId: routeSessionId } = useParams()
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState('')
  const { containerRef, endRef, enableStick, onContentChange } = useStickToBottom<HTMLDivElement>()
  const { items, resolvedCwd, isLoading, isSending, isPlanning, error, sendMessage, stopGeneration } = useChatSession({
    sessionId: routeSessionId,
    cwd: cwd.trim() || undefined,
    onSessionCreated: (sessionId) => {
      navigate(`/chat/${sessionId}`, { replace: true })
    },
  })

  const workspaceValue = routeSessionId ? resolvedCwd : cwd
  const workspaceReadOnly = Boolean(routeSessionId)

  useEffect(() => {
    onContentChange()
  }, [items, isPlanning, onContentChange])

  const handleSendMessage = useCallback(
    async (message: string, delivery: SessionMessageDelivery) => {
      const trimmed = message.trim()
      if (!trimmed || isLoading) return
      if (!isSending && delivery !== 'prompt') return

      enableStick()
      await sendMessage(trimmed, delivery)
      setInput('')
    },
    [enableStick, isLoading, isSending, sendMessage],
  )

  const handleFormSubmit = (event: React.FormEvent) => {
    event.preventDefault()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={containerRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {isLoading ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : null}

          {!isLoading && items.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{t('empty')}</p>
          ) : null}

          <ChatViewList items={items} />
          {isPlanning ? <PlanningIndicator /> : null}
          <div ref={endRef} aria-hidden />
        </div>
      </div>

      {error ? (
        <p className="shrink-0 px-4 pb-2 text-sm text-destructive">
          <span className="mx-auto block max-w-3xl">{error}</span>
        </p>
      ) : null}

      <form className="shrink-0 px-4 pb-4 pt-2" onSubmit={handleFormSubmit}>
        <div className="mx-auto max-w-3xl">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            isSending={isSending}
            onStop={() => void stopGeneration()}
            workspace={workspaceValue}
            workspaceReadOnly={workspaceReadOnly}
            onWorkspaceChange={setCwd}
          />
        </div>
      </form>
    </div>
  )
}
