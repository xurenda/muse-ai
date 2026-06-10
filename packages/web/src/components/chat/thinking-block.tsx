import { ProcessBlockHeader, useProcessBlockExpanded } from '@/components/chat/process-block-header'
import { useTranslation } from '@/hooks/use-translation'
import { formatDurationSeconds, getDurationMs } from '@/utils/chat-view'
import type { ThinkingViewItem } from '@/utils/chat-view'

interface ThinkingBlockProps {
  item: ThinkingViewItem
}

export function ThinkingBlock({ item }: ThinkingBlockProps) {
  const { t } = useTranslation('chat')
  const hasContent = item.content.trim().length > 0
  const [expanded, toggle] = useProcessBlockExpanded(item.status, hasContent)

  const durationMs = getDurationMs(item.startedAt, item.endedAt)
  const durationSeconds = formatDurationSeconds(durationMs)

  const activeLabel = t('thinking.active')
  const doneLabel =
    durationSeconds === null ? t('thinking.doneBrief') : t('thinking.done', { seconds: durationSeconds })

  return (
    <div className="w-full min-w-0">
      <ProcessBlockHeader
        active={item.status === 'active'}
        activeLabel={activeLabel}
        doneLabel={doneLabel}
        expanded={expanded}
        hasContent={hasContent}
        onToggle={toggle}
      />
      {expanded && hasContent ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.content}</p>
      ) : null}
    </div>
  )
}
