import { useState } from 'react'
import { ProcessBlockHeader, useProcessBlockExpanded } from '@/components/chat/process-block-header'
import { ToolGroupThinkingRow } from '@/components/chat/tool-group-thinking-row'
import { ToolRow } from '@/components/chat/tool-row'
import { useTranslation } from '@/hooks/use-translation'
import { countToolGroupTools, formatDurationSeconds, getDurationMs } from '@/utils/chat-view'
import type { ToolGroupViewItem } from '@/utils/chat-view'

interface ToolGroupBlockProps {
  item: ToolGroupViewItem
}

export function ToolGroupBlock({ item }: ToolGroupBlockProps) {
  const { t } = useTranslation('chat')
  const hasContent = item.entries.length > 0
  const [expanded, toggle] = useProcessBlockExpanded(item.status, hasContent)
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null)

  const durationMs = getDurationMs(item.startedAt, item.endedAt)
  const durationSeconds = formatDurationSeconds(durationMs)
  const count = countToolGroupTools(item.entries)

  const activeLabel = t('explore.active')
  const doneLabel =
    durationSeconds === null
      ? t('explore.doneBrief', { count })
      : t('explore.done', { count, seconds: durationSeconds })

  const toggleTool = (toolCallId: string) => {
    setExpandedToolId((current) => (current === toolCallId ? null : toolCallId))
  }

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
        <ul className="mt-2 flex flex-col gap-1">
          {item.entries.map((entry) => {
            if (entry.kind === 'thinking') {
              return <ToolGroupThinkingRow key={entry.id} entry={entry} />
            }

            return (
              <ToolRow
                key={entry.toolCallId}
                tool={entry}
                expanded={expandedToolId === entry.toolCallId}
                onToggle={() => toggleTool(entry.toolCallId)}
              />
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
