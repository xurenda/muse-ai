import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from 'react'
import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider
const Tooltip = TooltipPrimitive.Root
const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = forwardRef<ElementRef<typeof TooltipPrimitive.Content>, ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>>(
  ({ className, sideOffset = 6, ...props }, ref) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-xs rounded-md border border-popover-border bg-popover px-2.5 py-1.5 text-sm font-normal leading-snug text-popover-foreground shadow-popover',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  ),
)
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
