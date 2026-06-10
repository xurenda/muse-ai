import { AssistantMessage } from '@/components/chat/assistant-message'
import { ToolMessage } from '@/components/chat/tool-message'
import { UserMessage } from '@/components/chat/user-message'
import type { ChatMessage } from '@/utils/chat-message'

interface ChatMessageListProps {
  messages: ChatMessage[]
}

export function ChatMessageList({ messages }: ChatMessageListProps) {
  return (
    <div className="flex flex-col gap-6">
      {messages.map((message) => {
        if (message.role === 'user') {
          return <UserMessage key={message.id} content={message.content} />
        }

        if (message.role === 'tool') {
          return <ToolMessage key={message.id} toolName={message.toolName} content={message.content} />
        }

        return (
          <AssistantMessage key={message.id} content={message.content} streaming={message.streaming} />
        )
      })}
    </div>
  )
}
