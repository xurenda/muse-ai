import { type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { ChatMessage } from '@/lib/chat-types'
import { ChatMessageItem, shouldShowPlanning } from '@/components/chat/chat-message-item'

interface ChatMessageListProps {
  messages: ChatMessage[]
  messagesEndRef: RefObject<HTMLDivElement | null>
}

export function ChatMessageList({ messages, messagesEndRef }: ChatMessageListProps) {
  const { t } = useTranslation('chat')

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-center">
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{t('emptyHint')}</p>
      </div>
    )
  }

  const lastMessage = messages[messages.length - 1]

  return (
    <div className="flex flex-col gap-6">
      {messages.map((message, index) => (
        <ChatMessageItem
          key={message.id}
          message={message}
          showPlanning={index === messages.length - 1 && lastMessage !== undefined && shouldShowPlanning(message)}
        />
      ))}
      <div ref={messagesEndRef} aria-hidden />
    </div>
  )
}
