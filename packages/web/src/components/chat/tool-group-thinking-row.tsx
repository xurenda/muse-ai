import { Brain } from 'lucide-react'
import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/utils/cn'
import { formatDurationSeconds, getDurationMs } from '@/utils/chat-view'
import type { ToolGroupThinkingEntry } from '@/utils/chat-view'

interface ToolGroupThinkingRowProps {
  entry: ToolGroupThinkingEntry
}

export function ToolGroupThinkingRow({ entry }: ToolGroupThinkingRowProps) {
  const { t } = useTranslation('chat')
  const hasContent = entry.content.trim().length > 0
  const [expanded, setExpanded] = useState(entry.status === 'active')

  useEffect(() => {
    if (entry.status === 'active') {
      setExpanded(true)
      return
    }
    setExpanded(false)
  }, [entry.status])

  const durationMs = getDurationMs(entry.startedAt, entry.endedAt)
  const durationSeconds = formatDurationSeconds(durationMs)
  const active = entry.status === 'active'

  const label = active
    ? t('thinking.active')
    : durationSeconds === null
      ? t('thinking.doneBrief')
      : t('thinking.done', { seconds: durationSeconds })

  return (
    <li className="text-sm text-muted-foreground">
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 text-left text-sm leading-none',
          hasContent && 'hover:text-foreground',
        )}
        aria-expanded={expanded}
        disabled={!hasContent}
        onClick={hasContent ? () => setExpanded((value) => !value) : undefined}
      >
        <Brain className="size-3.5 shrink-0" strokeWidth={2} />
        <span className={cn('truncate', active && 'process-shimmer')}>{label}</span>
        {hasContent ? (
          <ChevronDown
            className={cn('size-3.5 shrink-0 transition-transform', !expanded && '-rotate-90')}
            strokeWidth={2}
          />
        ) : null}
      </button>
      {expanded && hasContent ? (
        <p className="mt-1 pl-5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground/90">{entry.content}</p>
      ) : null}
    </li>
  )
}
