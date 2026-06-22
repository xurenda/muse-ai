import { CirclePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ModelPickerMenu } from '@/components/model-picker/model-picker-menu'
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
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSearch('')
      // 关闭后延迟 blur，避免 Radix onCloseAutoFocus 把焦点还回 trigger
      window.setTimeout(() => triggerRef.current?.blur(), 0)
    }
  }

  return (
    <ModelPickerMenu
      open={open}
      onOpenChange={handleOpenChange}
      align="start"
      sideOffset={0}
      matchTriggerWidth
      closeOnSelect={false}
      variant="embedded"
      searchPlaceholder={t('models.strategy.searchModel')}
      search={search}
      onSearchChange={setSearch}
      catalog={catalog}
      selectionMode="multi"
      selectedModelRefs={new Set(pool)}
      onModelSelect={modelRef => onChange(togglePoolItem(pool, modelRef))}
      autoFocusSearch
      trigger={
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
      }
    />
  )
}
