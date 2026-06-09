import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { type ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

const iconButtonVariants = cva(
  'inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none focus:outline-none focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 hover:bg-foreground/6 hover:text-foreground data-[state=open]:bg-foreground/6 data-[state=open]:text-foreground',
)

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  asChild?: boolean
}

export function IconButton({ className, asChild = false, ...props }: IconButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(iconButtonVariants({ className }))} {...props} />
}
