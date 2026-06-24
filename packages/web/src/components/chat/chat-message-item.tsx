import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssistantChatMessage, ChatMessage } from '@/lib/chat-types'
import { isAssistantMessage } from '@/lib/chat-types'
import { getAssistantText, hasAssistantAnswer, hasAssistantThinking, hasAssistantToolCalls } from '@/lib/assistant-message-helpers'
import { groupAssistantBlocks } from '@/lib/group-assistant-blocks'
import { formatMessageTime } from '@/lib/format-message-time'
import { formatTurnStats } from '@/lib/format-turn-stats'
import { AssistantProcessRun } from '@/components/chat/assistant-process-run'
import { MarkdownContent } from '@/components/chat/markdown-content'
import { PlanningIndicator } from '@/components/chat/planning-indicator'
import { UserMessage } from '@/components/chat/user-message'
import { IconButton } from '@/components/ui/icon-button'

interface ChatMessageItemProps {
  message: ChatMessage
  showPlanning?: boolean
  streaming?: boolean
  prevUserMessageId?: string
  prevUserContent?: string
  onRetry?: (userMessageId: string, text: string) => void
  onEdit?: (userMessageId: string, text: string) => void
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

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation('chat')
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <IconButton type="button" tooltip={t('copy')} onClick={() => void handleCopy()} aria-label={t('copy')}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </IconButton>
  )
}

function AssistantMessageItem({ message, showPlanning }: { message: AssistantChatMessage; showPlanning?: boolean }) {
  const text = getAssistantText(message)
  const showCopy = !message.streaming && text.trim().length > 0

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <AssistantContentBlocks blocks={message.blocks} streaming={message.streaming} />
      {showPlanning ? <PlanningIndicator /> : null}
      {message.error ? <p className="text-sm text-destructive">{message.error}</p> : null}
      {showCopy ? (
        <div className="group/actions flex items-center gap-1.5">
          <CopyButton text={text} />
          {message.timestamp ? (
            <span className="text-xs text-muted-foreground tabular-nums opacity-0 group-hover/actions:opacity-100 transition-opacity">
              {formatMessageTime(message.timestamp)}
            </span>
          ) : null}
          {message.turnUsage && message.durationMs !== undefined ? (
            <span className="text-xs text-muted-foreground tabular-nums opacity-0 group-hover/actions:opacity-100 transition-opacity">
              {formatTurnStats(message.turnUsage.total, message.durationMs, false)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function ChatMessageItem({ message, showPlanning, onEdit }: ChatMessageItemProps) {
  const { t } = useTranslation('chat')

  if (message.role === 'user') {
    const modeLabel = message.mode !== 'prompt' ? t(`mode.${message.mode}`) : undefined
    return (
      <UserMessage
        content={message.content}
        modeLabel={modeLabel}
        timestamp={message.timestamp}
        onEdit={onEdit ? text => onEdit(message.id, text) : undefined}
      />
    )
  }

  return <AssistantMessageItem message={message} showPlanning={showPlanning} />
}

export function shouldShowPlanning(message: ChatMessage): boolean {
  if (!isAssistantMessage(message) || !message.streaming) return false
  return !hasAssistantAnswer(message) && !hasAssistantThinking(message) && !hasAssistantToolCalls(message)
}
