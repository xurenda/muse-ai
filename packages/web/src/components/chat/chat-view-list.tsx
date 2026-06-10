import { AnswerBlock } from '@/components/chat/answer-block'
import { ThinkingBlock } from '@/components/chat/thinking-block'
import { ToolGroupBlock } from '@/components/chat/tool-group-block'
import { UserMessage } from '@/components/chat/user-message'
import type { ChatViewItem } from '@/utils/chat-view'

interface ChatViewListProps {
  items: ChatViewItem[]
}

export function ChatViewList({ items }: ChatViewListProps) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        if (item.kind === 'user') {
          return <UserMessage key={item.id} content={item.content} />
        }

        if (item.kind === 'thinking') {
          return <ThinkingBlock key={item.id} item={item} />
        }

        if (item.kind === 'tool-group') {
          return <ToolGroupBlock key={item.id} item={item} />
        }

        return <AnswerBlock key={item.id} item={item} />
      })}
    </div>
  )
}
