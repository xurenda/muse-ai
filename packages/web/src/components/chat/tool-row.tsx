import { ChevronDown, Wrench } from 'lucide-react'
import { ToolDetailPanel } from '@/components/chat/tool-detail-panel'
import { cn } from '@/utils/cn'
import type { ToolGroupToolEntry } from '@/utils/chat-view'

interface ToolRowProps {
  tool: ToolGroupToolEntry
  expanded: boolean
  onToggle: () => void
}

export function ToolRow({ tool, expanded, onToggle }: ToolRowProps) {
  const isRunning = tool.status === 'running'
  const hasDetail = tool.input.trim().length > 0 || tool.output.trim().length > 0 || isRunning

  return (
    <li className="text-sm text-muted-foreground">
      <button
        type="button"
        className={cn(
          'flex items-center gap-1.5 text-left text-sm leading-none',
          hasDetail && 'hover:text-foreground',
        )}
        aria-expanded={expanded}
        disabled={!hasDetail}
        onClick={hasDetail ? onToggle : undefined}
      >
        <Wrench className="size-3.5 shrink-0" strokeWidth={2} />
        <span
          className={cn(
            'truncate',
            tool.isError && 'text-destructive',
            isRunning && 'process-shimmer',
          )}
        >
          {tool.toolName}
        </span>
        {hasDetail ? (
          <ChevronDown
            className={cn('size-3.5 shrink-0 transition-transform', !expanded && '-rotate-90')}
            strokeWidth={2}
          />
        ) : null}
      </button>

      {expanded && hasDetail ? (
        <ToolDetailPanel input={tool.input} output={tool.output} isRunning={isRunning} />
      ) : null}
    </li>
  )
}
