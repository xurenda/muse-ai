import { MarkdownContent } from '@/components/chat/markdown-content'
import type { AnswerViewItem } from '@/utils/chat-view'

interface AnswerBlockProps {
  item: AnswerViewItem
}

export function AnswerBlock({ item }: AnswerBlockProps) {
  if (!item.content.trim() && !item.streaming) {
    return null
  }

  return (
    <div className="w-full min-w-0">
      {item.content.trim() ? <MarkdownContent content={item.content} /> : null}
    </div>
  )
}