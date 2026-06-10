import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/utils/cn'

interface ProcessBlockHeaderProps {
  active: boolean
  activeLabel: string
  doneLabel: string
  expanded: boolean
  onToggle: () => void
  /** 有正文时才显示展开箭头 */
  hasContent?: boolean
}

export function ProcessBlockHeader({
  active,
  activeLabel,
  doneLabel,
  expanded,
  onToggle,
  hasContent = true,
}: ProcessBlockHeaderProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-1.5 text-left text-sm text-muted-foreground',
        hasContent && 'hover:text-foreground',
      )}
      aria-expanded={expanded}
      disabled={!hasContent}
      onClick={hasContent ? onToggle : undefined}
    >
      <span className={cn(active && 'process-shimmer')}>{active ? activeLabel : doneLabel}</span>
      {hasContent ? (
        <ChevronDown
          className={cn('size-3.5 shrink-0 transition-transform', !expanded && '-rotate-90')}
          strokeWidth={2}
        />
      ) : null}
    </button>
  )
}

/** 随 status 自动展开/折叠，完成后允许手动切换 */
export function useProcessBlockExpanded(status: 'active' | 'done', hasContent: boolean): [boolean, () => void] {
  const [expanded, setExpanded] = useState(status === 'active')

  useEffect(() => {
    if (status === 'active') {
      setExpanded(true)
      return
    }
    setExpanded(false)
  }, [status])

  const toggle = () => {
    if (!hasContent) {
      return
    }
    setExpanded((value) => !value)
  }

  return [expanded, toggle]
}
