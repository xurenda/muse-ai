import { Wrench } from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'
import type { ChatMessage } from '@/utils/chat-message'

interface ChatMessageListProps {
  messages: ChatMessage[]
}

export function ChatMessageList({ messages }: ChatMessageListProps) {
  const { t } = useTranslation('chat')

  return (
    <>
      {messages.map((message) => {
        if (message.role === 'user') {
          return (
            <div
              key={message.id}
              className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
            </div>
          )
        }

        if (message.role === 'tool') {
          return (
            <div
              key={message.id}
              className="mr-auto max-w-[90%] rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            >
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Wrench className="size-3.5" strokeWidth={2} />
                <span>{t('tool.label', { name: message.toolName ?? 'tool' })}</span>
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                {message.content}
              </pre>
            </div>
          )
        }

        return (
          <div
            key={message.id}
            className="mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground"
          >
            <pre className="whitespace-pre-wrap font-sans">{message.content || '…'}</pre>
          </div>
        )
      })}
    </>
  )
}
