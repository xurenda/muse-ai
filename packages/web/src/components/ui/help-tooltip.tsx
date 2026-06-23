import { CircleHelp } from 'lucide-react'
import { type ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface HelpTooltipProps {
  /** tooltip 内容，可以是字符串或任意 ReactNode */
  content: ReactNode
  /** aria-label，默认为 "帮助" */
  ariaLabel?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

/** 通用帮助问号图标 + Tooltip */
export function HelpTooltip({ content, ariaLabel = '帮助', side = 'top' }: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
            aria-label={ariaLabel}
          >
            <CircleHelp className="size-3.5" strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {typeof content === 'string' ? <p className="text-sm">{content}</p> : content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
