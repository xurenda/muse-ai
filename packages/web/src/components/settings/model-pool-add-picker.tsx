import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ModelCatalogItem } from '@/utils/model-strategy-ui'

interface ModelPoolAddPickerProps {
  candidates: ModelCatalogItem[]
  onSelect: (modelRef: string) => void
  className?: string
}

export function ModelPoolAddPicker({ candidates, onSelect, className }: ModelPoolAddPickerProps) {
  const { t } = useTranslation('settings')
  const disabled = candidates.length === 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full cursor-pointer items-center justify-between gap-inline rounded-control border border-border/50 bg-background px-field-x py-menu-y text-sm text-muted-foreground outline-none transition-colors hover:border-border focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-ring',
            className,
          )}
        >
          <span className="truncate text-left">{t('models.strategy.pickModel')}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="min-w-[var(--radix-dropdown-menu-trigger-width)] w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto"
      >
        <DropdownMenuRadioGroup
          value=""
          onValueChange={value => {
            if (value) onSelect(value)
          }}
        >
          {candidates.map(item => (
            <DropdownMenuRadioItem key={item.modelRef} value={item.modelRef}>
              {item.modelName}
              <span className="ml-1 text-xs text-muted-foreground">({item.providerName})</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
