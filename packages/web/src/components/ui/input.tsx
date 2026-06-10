import { cva, type VariantProps } from 'class-variance-authority'
import { type InputHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

const fieldVariants = cva(
  'w-full rounded-md border border-border/50 bg-background px-2 py-1 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground placeholder:opacity-100 hover:border-border focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
)

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, VariantProps<typeof fieldVariants> {}

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(fieldVariants(), className)} {...props} />
}
