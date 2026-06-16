import { useTranslation } from 'react-i18next'
import type { AssistantChatMessage, ChatMessage } from '@/lib/chat-types'
import { isAssistantMessage } from '@/lib/chat-types'
import { AssistantThinkingBlock } from '@/components/chat/assistant-thinking-block'
import { AssistantToolGroup } from '@/components/chat/assistant-tool-group'
import { MarkdownContent } from '@/components/chat/markdown-content'
import { PlanningIndicator } from '@/components/chat/planning-indicator'
import { UserMessage } from '@/components/chat/user-message'

interface ChatMessageItemProps {
  message: ChatMessage
  showPlanning?: boolean
}

function AssistantMessageItem({ message, showPlanning }: { message: AssistantChatMessage; showPlanning?: boolean }) {
  const hasAnswer = message.text.trim().length > 0
  const hasToolCalls = message.toolCalls.length > 0

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <AssistantThinkingBlock content={message.thinking} streaming={message.streaming} hasToolCalls={hasToolCalls} hasAnswer={hasAnswer} />
      <AssistantToolGroup tools={message.toolCalls} />
      <MarkdownContent content={message.text} />
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
  return !message.text.trim() && !message.thinking.trim() && message.toolCalls.length === 0
}
