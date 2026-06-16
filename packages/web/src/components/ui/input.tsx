import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const fieldVariants = cva(
  'w-full rounded-control border border-border/50 bg-background px-field-x py-field-y text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground placeholder:opacity-100 hover:border-border focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
)

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof fieldVariants> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => (
  <input type={type} className={cn(fieldVariants(), className)} ref={ref} {...props} />
))
Input.displayName = 'Input'
