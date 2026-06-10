import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { type ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

const buttonVariants = cva(
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm transition-colors outline-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary font-medium text-primary-foreground enabled:hover:bg-primary/90',
        outline:
          'font-normal text-muted-foreground enabled:hover:bg-foreground/6 enabled:hover:text-foreground data-[state=open]:bg-foreground/6 data-[state=open]:text-foreground',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-6 gap-1 px-2 text-xs',
        icon: 'size-6 shrink-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
