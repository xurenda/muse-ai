import { useState } from 'react'
import { useTranslation } from '@/hooks/use-translation'
import { useChatSession } from '@/hooks/use-chat-session'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function NewChatPage() {
  const { t } = useTranslation('chat')
  const [input, setInput] = useState('')
  const [cwd, setCwd] = useState('')
  const { messages, isSending, error, sendMessage } = useChatSession({
    cwd: cwd.trim() || undefined,
  })

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
            value={cwd}
            onChange={(event) => setCwd(event.target.value)}
          />
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
                : 'mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground'
            }
          >
            <pre className="whitespace-pre-wrap font-sans">{message.content || '…'}</pre>
          </div>
        ))}
      </div>

      {error ? <p className="px-4 pb-2 text-sm text-destructive">{error}</p> : null}

      <form className="flex gap-2 border-t border-border px-4 py-3" onSubmit={handleSubmit}>
        <Input
          className="min-w-0 flex-1"
          placeholder={t('input.placeholder')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isSending}
        />
        <Button type="submit" disabled={isSending || !input.trim()}>
          {isSending ? t('input.sending') : t('input.send')}
        </Button>
      </form>
    </div>
  )
}
