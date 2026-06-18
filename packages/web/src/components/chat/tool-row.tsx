import { ChevronDown, Wrench } from 'lucide-react'
import { ToolDetailPanel } from '@/components/chat/tool-detail-panel'
import type { ToolCallItem } from '@/lib/chat-types'
import { formatToolJson } from '@/lib/format-tool-io'
import { cn } from '@/lib/utils'

interface ToolRowProps {
  tool: ToolCallItem
  expanded: boolean
  onToggle: () => void
  plain?: boolean
}

export function ToolRow({ tool, expanded, onToggle, plain = false }: ToolRowProps) {
  const input = formatToolJson(tool.args)
  const output = formatToolJson(tool.result)
  const isRunning = tool.status === 'running'
  const hasDetail = input.trim().length > 0 || output.trim().length > 0 || isRunning

  return (
    <li className="text-sm text-muted-foreground">
      <button
        type="button"
        className={cn('flex items-center gap-1.5 text-left text-sm leading-none', hasDetail && 'hover:text-foreground')}
        aria-expanded={expanded}
        disabled={!hasDetail}
        onClick={hasDetail ? onToggle : undefined}
      >
        {plain ? null : <Wrench className="size-3.5 shrink-0" strokeWidth={2} />}
        <span className={cn('truncate', tool.isError && 'text-destructive', isRunning && 'process-shimmer')}>{tool.toolName}</span>
        {hasDetail ? <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', !expanded && '-rotate-90')} strokeWidth={2} /> : null}
      </button>

      {expanded && hasDetail ? <ToolDetailPanel input={input} output={output} isRunning={isRunning} /> : null}
    </li>
  )
}
