import { Check, CirclePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { togglePoolItem, type ModelCatalogItem } from '@/utils/model-strategy-ui'

interface ModelPoolAddPickerProps {
  catalog: ModelCatalogItem[]
  pool: string[]
  onChange: (nextPool: string[]) => void
  className?: string
}

export function ModelPoolAddPicker({ catalog, pool, onChange, className }: ModelPoolAddPickerProps) {
  const { t } = useTranslation('settings')
  const disabled = catalog.length === 0
  const selectedRefs = new Set(pool)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      // 关闭后延迟 blur，避免 Radix onCloseAutoFocus 把焦点还回 trigger
      window.setTimeout(() => triggerRef.current?.blur(), 0)
    }
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full cursor-pointer items-center justify-center gap-inline border border-dashed border-border/70 bg-background px-menu-x py-menu-y text-sm text-muted-foreground outline-none transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-ring data-[state=open]:text-foreground',
            className,
          )}
        >
          <CirclePlus className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
          <span className="truncate">{t('models.strategy.pickModel')}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={0}
        onCloseAutoFocus={event => event.preventDefault()}
        className="min-w-[var(--radix-dropdown-menu-trigger-width)] w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto rounded-none border-border/70 p-0 shadow-none"
      >
        {catalog.map(item => {
          const selected = selectedRefs.has(item.modelRef)

          return (
            <DropdownMenuItem
              key={item.modelRef}
              className="gap-inline rounded-none px-menu-x py-menu-y"
              onSelect={event => event.preventDefault()}
              onClick={() => onChange(togglePoolItem(pool, item.modelRef))}
            >
              <span className="flex size-3.5 shrink-0 items-center justify-center text-foreground">
                {selected ? <Check className="size-3.5" strokeWidth={2} /> : null}
              </span>
              <div className="flex min-w-0 flex-1 items-center gap-inline">
                <span className="truncate text-sm text-foreground">{item.modelName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{item.modelRef}</span>
              </div>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
