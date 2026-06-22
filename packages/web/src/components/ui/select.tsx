import { ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  value: string
  options: SelectOption[]
  onValueChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  menuAlign?: 'start' | 'center' | 'end'
}

export function Select({ value, options, onValueChange, disabled, placeholder, className, menuAlign = 'start' }: SelectProps) {
  const selectedLabel = options.find(option => option.value === value)?.label

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full cursor-pointer items-center justify-between gap-inline rounded-control border border-border/50 bg-background px-field-x py-menu-y text-sm text-foreground outline-none transition-colors hover:border-border focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-ring',
            className,
          )}
        >
          <span className={cn('truncate text-left', !selectedLabel && 'text-muted-foreground')}>{selectedLabel ?? placeholder}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={menuAlign} className="min-w-[var(--radix-dropdown-menu-trigger-width)] w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {options.map(option => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
