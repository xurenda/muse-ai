import { useTranslation } from 'react-i18next'
import type { ChatMessage } from '@/lib/chat-types'
import { MarkdownContent } from '@/components/chat/markdown-content'
import { ThinkingBlock, ToolCallCard } from '@/components/chat/message-parts'
import { cn } from '@/lib/utils'

interface ChatMessageItemProps {
  message: ChatMessage
}

export function ChatMessageItem({ message }: ChatMessageItemProps) {
  const { t } = useTranslation('chat')

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary/15 px-4 py-3">
          {message.mode !== 'prompt' ? <p className="mb-1 text-[10px] uppercase tracking-wide text-primary">{t(`mode.${message.mode}`)}</p> : null}
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className={cn('max-w-[95%] rounded-lg border border-border bg-card px-4 py-3', message.error && 'border-destructive/50')}>
        <ThinkingBlock content={message.thinking} streaming={message.streaming && Boolean(message.thinking)} />
        {message.toolCalls.map(tool => (
          <ToolCallCard key={tool.toolCallId} toolName={tool.toolName} args={tool.args} result={tool.result} isError={tool.isError} status={tool.status} />
        ))}
        <MarkdownContent content={message.text} />
        {message.streaming && !message.text && !message.thinking && message.toolCalls.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('assistantThinking')}</p>
        ) : null}
        {message.error ? <p className="mt-2 text-sm text-destructive">{message.error}</p> : null}
      </div>
    </div>
  )
}
