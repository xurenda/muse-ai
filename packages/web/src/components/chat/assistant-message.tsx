import { MarkdownContent } from '@/components/chat/markdown-content'
import { StreamingCursor } from '@/components/chat/streaming-cursor'

interface AssistantMessageProps {
  content: string
  streaming?: boolean
}

export function AssistantMessage({ content, streaming }: AssistantMessageProps) {
  const displayContent = content || '…'

  return (
    <div className="w-full min-w-0">
      <MarkdownContent content={displayContent} />
      {streaming ? <StreamingCursor /> : null}
    </div>
  )
}
