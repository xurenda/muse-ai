import { useTranslation } from 'react-i18next'
import { ProcessBlockHeader, useProcessBlockExpanded } from '@/components/chat/process-block-header'

interface AssistantThinkingBlockProps {
  content: string
  active: boolean
  durationMs?: number
}

function resolveThinkingDoneLabel(durationMs: number | undefined, t: (key: string, options?: Record<string, number>) => string): string {
  if (durationMs === undefined || durationMs < 1000) {
    return t('thinking.doneBrief')
  }
  return t('thinking.doneSeconds', { seconds: Math.round(durationMs / 1000) })
}

export function AssistantThinkingBlock({ content, active, durationMs }: AssistantThinkingBlockProps) {
  const { t } = useTranslation('chat')
  const hasContent = content.trim().length > 0
  const visible = hasContent || active
  const status = active ? 'active' : 'done'
  const [expanded, toggle] = useProcessBlockExpanded(status, hasContent)

  if (!visible) return null

  const doneLabel = resolveThinkingDoneLabel(durationMs, t)

  return (
    <div className="w-full min-w-0">
      <ProcessBlockHeader
        active={active}
        activeLabel={t('thinking.active')}
        doneLabel={doneLabel}
        expanded={expanded}
        hasContent={hasContent}
        onToggle={toggle}
      />
      {expanded && hasContent ? <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{content}</p> : null}
    </div>
  )
}
