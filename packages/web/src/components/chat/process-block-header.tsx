import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ProcessBlockHeaderProps {
  active: boolean
  activeLabel: string
  doneLabel: string
  expanded: boolean
  onToggle: () => void
  hasContent?: boolean
}

export function ProcessBlockHeader({ active, activeLabel, doneLabel, expanded, onToggle, hasContent = true }: ProcessBlockHeaderProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-1.5 text-left text-sm text-muted-foreground',
        hasContent ? 'cursor-pointer hover:text-foreground' : 'cursor-default',
      )}
      aria-expanded={expanded}
      disabled={!hasContent}
      onClick={hasContent ? onToggle : undefined}
    >
      <span className={cn(active && 'process-shimmer')}>{active ? activeLabel : doneLabel}</span>
      {hasContent ? <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', !expanded && '-rotate-90')} strokeWidth={2} /> : null}
    </button>
  )
}

export function useProcessBlockExpanded(status: 'active' | 'done', hasContent: boolean): [boolean, () => void] {
  const [userOverride, setUserOverride] = useState<{ status: 'active' | 'done'; expanded: boolean } | null>(null)
  const expanded = userOverride?.status === status ? userOverride.expanded : status === 'active'

  const toggle = () => {
    if (!hasContent) return
    setUserOverride({ status, expanded: !expanded })
  }

  return [expanded, toggle]
}
