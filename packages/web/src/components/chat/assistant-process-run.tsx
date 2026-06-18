import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AssistantThinkingBlock } from '@/components/chat/assistant-thinking-block'
import { ProcessBlockHeader, useProcessBlockExpanded } from '@/components/chat/process-block-header'
import { ToolRow } from '@/components/chat/tool-row'
import { countProcessRun, flattenProcessRunItems, resolveProcessRunSummaryKey, type ProcessContentBlock } from '@/lib/group-assistant-blocks'

interface AssistantProcessRunProps {
  blocks: ProcessContentBlock[]
  /** 流式尾部：直接展开列表，不显示汇总标题 */
  active: boolean
}

function ProcessRunItemList({
  items,
  active,
  expandedToolId,
  onToggleTool,
}: {
  items: ReturnType<typeof flattenProcessRunItems>
  active: boolean
  expandedToolId: string | null
  onToggleTool: (toolCallId: string) => void
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item, index) => {
        if (item.kind === 'thinking') {
          const thinkingActive = active && index === items.length - 1
          return (
            <li key={`thinking-${index}`}>
              <AssistantThinkingBlock content={item.thinking} active={thinkingActive} durationMs={item.durationMs} />
            </li>
          )
        }
        return (
          <ToolRow
            key={item.tool.toolCallId}
            tool={item.tool}
            expanded={expandedToolId === item.tool.toolCallId}
            plain
            onToggle={() => onToggleTool(item.tool.toolCallId)}
          />
        )
      })}
    </ul>
  )
}

export function AssistantProcessRun({ blocks, active }: AssistantProcessRunProps) {
  const { t } = useTranslation('chat')
  const { thinkingCount, toolCount } = countProcessRun(blocks)
  const items = flattenProcessRunItems(blocks)
  const hasContent = items.length > 0
  const status = active ? 'active' : 'done'
  const [expanded, toggle] = useProcessBlockExpanded(status, hasContent)
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null)

  if (!hasContent) return null

  const toggleTool = (toolCallId: string) => {
    setExpandedToolId(current => (current === toolCallId ? null : toolCallId))
  }

  if (items.length === 1) {
    const item = items[0]
    if (item?.kind === 'thinking') {
      return <AssistantThinkingBlock content={item.thinking} active={active} durationMs={item.durationMs} />
    }
    if (item?.kind === 'tool') {
      return <ToolRow tool={item.tool} expanded={expandedToolId === item.tool.toolCallId} plain onToggle={() => toggleTool(item.tool.toolCallId)} />
    }
  }

  const summaryKey = resolveProcessRunSummaryKey(thinkingCount, toolCount)
  const summaryLabel =
    summaryKey === 'both'
      ? t('processRun.collapsedBoth', { thinkingCount, toolCount })
      : summaryKey === 'toolsOnly'
        ? t('processRun.collapsedToolsOnly', { toolCount })
        : summaryKey === 'thinkingOnly'
          ? t('processRun.collapsedThinkingOnly', { thinkingCount })
          : ''

  const showList = active || expanded

  return (
    <div className="w-full min-w-0">
      {!active && summaryLabel ? (
        <ProcessBlockHeader active={false} activeLabel={summaryLabel} doneLabel={summaryLabel} expanded={expanded} hasContent={hasContent} onToggle={toggle} />
      ) : null}
      {showList ? (
        <div className={active ? undefined : 'mt-2'}>
          <ProcessRunItemList items={items} active={active} expandedToolId={expandedToolId} onToggleTool={toggleTool} />
        </div>
      ) : null}
    </div>
  )
}
