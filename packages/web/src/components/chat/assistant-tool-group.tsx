import { useState } from 'react'
import { ProcessBlockHeader, useProcessBlockExpanded } from '@/components/chat/process-block-header'
import { ToolRow } from '@/components/chat/tool-row'
import type { ToolCallItem } from '@/lib/chat-types'
import { useTranslation } from 'react-i18next'

interface AssistantToolGroupProps {
  tools: ToolCallItem[]
}

export function AssistantToolGroup({ tools }: AssistantToolGroupProps) {
  const { t } = useTranslation('chat')
  const hasContent = tools.length > 0
  const active = tools.some(tool => tool.status === 'running')
  const status = active ? 'active' : 'done'
  const [expanded, toggle] = useProcessBlockExpanded(status, hasContent)
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null)

  if (!hasContent) return null

  const count = tools.length
  const activeLabel = t('explore.active')
  const doneLabel = t('explore.doneBrief', { count })

  const toggleTool = (toolCallId: string) => {
    setExpandedToolId(current => (current === toolCallId ? null : toolCallId))
  }

  return (
    <div className="w-full min-w-0">
      <ProcessBlockHeader
        active={status === 'active'}
        activeLabel={activeLabel}
        doneLabel={doneLabel}
        expanded={expanded}
        hasContent={hasContent}
        onToggle={toggle}
      />
      {expanded && hasContent ? (
        <ul className="mt-2 flex flex-col gap-1">
          {tools.map(tool => (
            <ToolRow key={tool.toolCallId} tool={tool} expanded={expandedToolId === tool.toolCallId} onToggle={() => toggleTool(tool.toolCallId)} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}
