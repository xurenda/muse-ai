import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const fieldVariants = cva(
  'w-full resize-none rounded-control border border-border/50 bg-background px-field-x py-menu-y text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground placeholder:opacity-100 hover:border-border focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50',
)

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, VariantProps<typeof fieldVariants> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(fieldVariants(), className)} {...props} />
})
Textarea.displayName = 'Textarea'
