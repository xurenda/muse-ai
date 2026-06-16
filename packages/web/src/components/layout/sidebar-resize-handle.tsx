import { Separator } from 'react-resizable-panels'
import { cn } from '@/lib/utils'

interface SidebarResizeHandleProps {
  disabled?: boolean
}

export function SidebarResizeHandle({ disabled }: SidebarResizeHandleProps) {
  return (
    <Separator
      disabled={disabled}
      className={cn(
        'relative w-px shrink-0 bg-sidebar-border transition-colors',
        'before:absolute before:inset-y-0 before:-left-1 before:-right-1 before:content-[""]',
        !disabled && 'cursor-col-resize hover:bg-muted-foreground/55',
      )}
    />
  )
}
