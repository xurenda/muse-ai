import { type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMessage } from '@/lib/chat-types'
import { ChatMessageItem } from '@/components/chat/chat-message-item'

interface ChatMessageListProps {
  messages: ChatMessage[]
  messagesEndRef: RefObject<HTMLDivElement | null>
}

export function ChatMessageList({ messages, messagesEndRef }: ChatMessageListProps) {
  const { t } = useTranslation('chat')

  if (messages.length === 0) {
    return <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">{t('emptyHint')}</div>
  }

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-6">
      {messages.map(message => (
        <ChatMessageItem key={message.id} message={message} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
