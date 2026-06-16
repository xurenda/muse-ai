import { useTranslation } from 'react-i18next'
import { ProcessBlockHeader, useProcessBlockExpanded } from '@/components/chat/process-block-header'

interface AssistantThinkingBlockProps {
  content: string
  streaming: boolean
  hasToolCalls: boolean
  hasAnswer: boolean
}

export function AssistantThinkingBlock({ content, streaming, hasToolCalls, hasAnswer }: AssistantThinkingBlockProps) {
  const { t } = useTranslation('chat')
  const hasContent = content.trim().length > 0
  const visible = hasContent || (streaming && !hasAnswer && !hasToolCalls)
  const active = streaming && !hasAnswer && !hasToolCalls
  const status = active ? 'active' : 'done'
  const [expanded, toggle] = useProcessBlockExpanded(status, hasContent)

  if (!visible) return null

  return (
    <div className="w-full min-w-0">
      <ProcessBlockHeader
        active={active}
        activeLabel={t('thinking.active')}
        doneLabel={t('thinking.doneBrief')}
        expanded={expanded}
        hasContent={hasContent}
        onToggle={toggle}
      />
      {expanded && hasContent ? <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{content}</p> : null}
    </div>
  )
}
