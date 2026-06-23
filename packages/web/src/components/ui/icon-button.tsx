import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const iconButtonVariants = cva(
  'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-foreground/6 enabled:hover:text-foreground data-[state=open]:bg-foreground/6 data-[state=open]:text-foreground',
)

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof iconButtonVariants> {
  asChild?: boolean
  tooltip?: ReactNode
}

export function IconButton({ className, asChild = false, tooltip, ...props }: IconButtonProps) {
  const Comp = asChild ? Slot : 'button'
  const btn = <Comp className={cn(iconButtonVariants(), className)} {...props} />
  if (!tooltip) return btn
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
