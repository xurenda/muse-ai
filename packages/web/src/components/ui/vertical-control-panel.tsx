import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface VerticalControlPanelProps {
  children: ReactNode
  className?: string
}

/** 竖向工具条外壳，与 session 树 Flow Controls 视觉一致 */
export function VerticalControlPanel({ children, className }: VerticalControlPanelProps) {
  return <div className={cn('flex flex-col overflow-hidden rounded-md border border-border bg-white shadow-sm', className)}>{children}</div>
}

/** 竖向工具条按钮共用样式 */
export function verticalControlButtonClassName({ isFirst = false, className }: { isFirst?: boolean; className?: string } = {}) {
  return cn(
    'flex size-7 cursor-pointer items-center justify-center bg-white text-foreground transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40',
    !isFirst && 'border-t border-border',
    className,
  )
}

interface VerticalControlButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tooltip: string
  tooltipSide?: 'left' | 'right' | 'top' | 'bottom'
  isFirst?: boolean
  children: ReactNode
}

export function VerticalControlButton({ tooltip, tooltipSide = 'left', isFirst = false, className, children, ...props }: VerticalControlButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={verticalControlButtonClassName({ isFirst, className })} {...props}>
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

interface VerticalControlPanelWithTooltipsProps {
  children: ReactNode
  className?: string
}

/** 包裹 TooltipProvider，避免每个按钮重复创建 */
export function VerticalControlPanelWithTooltips({ children, className }: VerticalControlPanelWithTooltipsProps) {
  return (
    <VerticalControlPanel className={className}>
      <TooltipProvider>{children}</TooltipProvider>
    </VerticalControlPanel>
  )
}
