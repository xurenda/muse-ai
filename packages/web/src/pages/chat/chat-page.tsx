import { FolderOpen, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChatViewList } from '@/components/chat/chat-view-list'
import { PlanningIndicator } from '@/components/chat/planning-indicator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useChatSession } from '@/hooks/use-chat-session'
import { useStickToBottom } from '@/hooks/use-stick-to-bottom'
import { useTranslation } from '@/hooks/use-translation'

const TEXTAREA_MAX_HEIGHT = 200

export function ChatPage() {
  const { t } = useTranslation('chat')
  const navigate = useNavigate()
  const { sessionId: routeSessionId } = useParams()
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
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

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`
  }, [input])

  const handleSubmit = useCallback(
    async (delivery: 'prompt' | 'steer' | 'followUp' = 'prompt') => {
      const trimmed = input.trim()
      if (!trimmed || isLoading) return
      if (!isSending && delivery !== 'prompt') return

      enableStick()
      await sendMessage(trimmed, delivery)
      setInput('')
    },
    [enableStick, input, isLoading, isSending, sendMessage],
  )

  const handleFormSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await handleSubmit(isSending ? 'steer' : 'prompt')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSubmit(isSending ? 'steer' : 'prompt')
      return
    }

    if (event.key === 'Enter' && event.shiftKey && isSending) {
      event.preventDefault()
      void handleSubmit('followUp')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-2">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
          {workspaceReadOnly ? (
            <span className="truncate text-xs text-muted-foreground" title={workspaceValue}>
              {workspaceValue || t('workspace.unset')}
            </span>
          ) : (
            <Input
              className="h-7 min-w-0 flex-1 text-xs"
              placeholder={t('workspace.placeholder')}
              value={workspaceValue}
              onChange={(event) => setCwd(event.target.value)}
            />
          )}
        </div>
      </div>

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

      <form className="shrink-0 border-t border-border px-4 py-3" onSubmit={handleFormSubmit}>
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            ref={textareaRef}
            className="min-h-9 max-h-[200px] min-w-0 flex-1 py-2"
            rows={1}
            placeholder={isSending ? t('input.placeholderStreaming') : t('input.placeholder')}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          {isSending ? (
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={isLoading}
              onClick={() => {
                void stopGeneration()
              }}
            >
              <Square className="size-3.5 fill-current" strokeWidth={0} />
              {t('input.stop')}
            </Button>
          ) : null}
          <Button
            type="submit"
            className="shrink-0"
            disabled={isLoading || !input.trim()}
          >
            {isSending ? t('input.steer') : t('input.send')}
          </Button>
        </div>
      </form>
    </div>
  )
}
