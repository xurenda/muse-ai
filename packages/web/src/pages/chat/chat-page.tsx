import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from '@/hooks/use-translation'
import { ChatMessageList } from '@/components/chat/chat-message-list'
import { useChatSession } from '@/hooks/use-chat-session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ChatPage() {
  const { t } = useTranslation('chat')
  const navigate = useNavigate()
  const { sessionId: routeSessionId } = useParams()
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState('')
  const { messages, resolvedCwd, isLoading, isSending, error, sendMessage } = useChatSession({
    sessionId: routeSessionId,
    cwd: cwd.trim() || undefined,
    onSessionCreated: (sessionId) => {
      navigate(`/chat/${sessionId}`, { replace: true })
    },
  })

  const workspaceValue = routeSessionId ? resolvedCwd : cwd
  const workspaceReadOnly = Boolean(routeSessionId)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await sendMessage(input)
    setInput('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border px-4 py-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {t('workspace.label')}
          <Input
            placeholder={t('workspace.placeholder')}
            value={workspaceValue}
            onChange={(event) => setCwd(event.target.value)}
            readOnly={workspaceReadOnly}
          />
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {isLoading ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : null}

        {!isLoading && messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : null}

        <ChatMessageList messages={messages} />
      </div>

      {error ? <p className="px-4 pb-2 text-sm text-destructive">{error}</p> : null}

      <form className="flex gap-2 border-t border-border px-4 py-3" onSubmit={handleSubmit}>
        <Input
          className="min-w-0 flex-1"
          placeholder={t('input.placeholder')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isSending || isLoading}
        />
        <Button type="submit" disabled={isSending || isLoading || !input.trim()}>
          {isSending ? t('input.sending') : t('input.send')}
        </Button>
      </form>
    </div>
  )
}
