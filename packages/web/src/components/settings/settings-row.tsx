import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface SettingsRowProps {
  title: string
  description?: string
  children?: ReactNode
  expanded?: ReactNode
  className?: string
  onClick?: () => void
}

export function SettingsRow({
  title,
  description,
  children,
  expanded,
  className,
  onClick,
}: SettingsRowProps) {
  const interactive = Boolean(onClick)
  const isExpanded = expanded !== undefined

  return (
    <div className={cn('border-b border-sidebar-border last:border-b-0', className)}>
      <div
        className={cn(
          'flex items-center justify-between gap-4 px-4 py-3.5',
          interactive && 'cursor-pointer hover:bg-sidebar-accent/40',
          isExpanded && 'bg-sidebar-accent/40',
        )}
        onClick={onClick}
        onKeyDown={
          interactive
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onClick?.()
                }
              }
            : undefined
        }
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
      </div>
      {expanded ? <div className="border-t border-sidebar-border px-4 py-3.5">{expanded}</div> : null}
    </div>
  )
}
