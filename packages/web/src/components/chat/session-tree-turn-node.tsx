import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { IconButton } from '@/components/ui/icon-button'
import type { SessionTurnFlowNodeData } from '@/lib/session-tree-utils'
import { cn } from '@/lib/utils'
import { GitBranchPlus } from 'lucide-react'

export const SessionTreeTurnNode = memo(function SessionTreeTurnNode({ data }: NodeProps<Node<SessionTurnFlowNodeData>>) {
  const { t } = useTranslation('chat')
  const { turn, active, disabled, onNavigate, onFork } = data

  return (
    <div
      className={cn(
        'group pointer-events-auto relative h-full w-full rounded-lg border bg-card px-2.5 py-2 text-left shadow-sm transition-colors',
        active ? 'border-primary bg-accent/70 shadow-md' : 'border-border hover:border-primary/40',
      )}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} className="!pointer-events-none !h-1.5 !w-1.5 !border-border !bg-muted-foreground" />

      <button
        type="button"
        disabled={disabled}
        className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => onNavigate(turn.entryId)}
      >
        {turn.branchSummary ? (
          <p className="line-clamp-3 text-[11px] leading-4 text-muted-foreground">{turn.branchSummary}</p>
        ) : (
          <div className="space-y-1">
            {turn.userPreview ? (
              <p className="line-clamp-2 text-[11px] leading-4 text-foreground">
                <span className="mr-1 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">U</span>
                {turn.userPreview}
              </p>
            ) : null}
            {turn.assistantPreview ? (
              <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                <span className="mr-1 rounded bg-muted px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">A</span>
                {turn.assistantPreview}
              </p>
            ) : null}
          </div>
        )}
      </button>

      <IconButton
        type="button"
        tooltip={t('fork')}
        className="absolute -right-1 -top-1 size-6 rounded-full border border-border bg-background opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        disabled={disabled}
        aria-label={t('fork')}
        onClick={event => {
          event.stopPropagation()
          onFork(turn.entryId)
        }}
      >
        <GitBranchPlus className="size-3.5" strokeWidth={2} />
      </IconButton>

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="!pointer-events-none !h-1.5 !w-1.5 !border-border !bg-muted-foreground"
      />
    </div>
  )
})
