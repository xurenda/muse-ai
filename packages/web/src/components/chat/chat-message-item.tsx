import { useTranslation } from 'react-i18next'
import type { AssistantChatMessage, ChatMessage } from '@/lib/chat-types'
import { isAssistantMessage } from '@/lib/chat-types'
import { hasAssistantAnswer, hasAssistantThinking, hasAssistantToolCalls } from '@/lib/assistant-message-helpers'
import { groupAssistantBlocks } from '@/lib/group-assistant-blocks'
import { AssistantProcessRun } from '@/components/chat/assistant-process-run'
import { MarkdownContent } from '@/components/chat/markdown-content'
import { PlanningIndicator } from '@/components/chat/planning-indicator'
import { UserMessage } from '@/components/chat/user-message'

interface ChatMessageItemProps {
  message: ChatMessage
  showPlanning?: boolean
}

function AssistantContentBlocks({ blocks, streaming }: { blocks: AssistantChatMessage['blocks']; streaming: boolean }) {
  const segments = groupAssistantBlocks(blocks)

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <MarkdownContent key={`text-${index}`} content={segment.text} />
        }
        const isLastSegment = index === segments.length - 1
        const active = streaming && isLastSegment
        return <AssistantProcessRun key={`process-${index}`} blocks={segment.blocks} active={active} />
      })}
    </>
  )
}

function AssistantMessageItem({ message, showPlanning }: { message: AssistantChatMessage; showPlanning?: boolean }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <AssistantContentBlocks blocks={message.blocks} streaming={message.streaming} />
      {showPlanning ? <PlanningIndicator /> : null}
      {message.error ? <p className="text-sm text-destructive">{message.error}</p> : null}
    </div>
  )
}

export function ChatMessageItem({ message, showPlanning }: ChatMessageItemProps) {
  const { t } = useTranslation('chat')

  if (message.role === 'user') {
    const modeLabel = message.mode !== 'prompt' ? t(`mode.${message.mode}`) : undefined
    return <UserMessage content={message.content} modeLabel={modeLabel} />
  }

  return <AssistantMessageItem message={message} showPlanning={showPlanning} />
}

export function shouldShowPlanning(message: ChatMessage): boolean {
  if (!isAssistantMessage(message) || !message.streaming) return false
  return !hasAssistantAnswer(message) && !hasAssistantThinking(message) && !hasAssistantToolCalls(message)
}
