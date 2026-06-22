import { Check } from 'lucide-react'
import { type KeyboardEvent, type ReactNode, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { filterModelCatalog, groupModelCatalogByProvider, type ModelCatalogItem } from '@/utils/model-strategy-ui'

export interface ModelPickerQuickOption {
  id: string
  label: string
  selected?: boolean
}

export interface ModelPickerPanelProps {
  searchPlaceholder: string
  search: string
  onSearchChange: (value: string) => void
  catalog: ModelCatalogItem[]
  onModelSelect: (modelRef: string) => void
  quickOptions?: ModelPickerQuickOption[]
  onQuickOptionSelect?: (id: string) => void
  selectionMode?: 'single' | 'multi'
  selectedModelRef?: string | null
  selectedModelRefs?: ReadonlySet<string>
  emptyMessage?: string
  disabled?: boolean
  className?: string
  /** popover：独立浮层；embedded：嵌入 Settings 展开区，无圆角/阴影 */
  variant?: 'popover' | 'embedded'
  widthClassName?: string
  maxHeightClassName?: string
  autoFocusSearch?: boolean
  onSearchKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  footer?: ReactNode
}

export function ModelPickerPanel({
  searchPlaceholder,
  search,
  onSearchChange,
  catalog,
  onModelSelect,
  quickOptions,
  onQuickOptionSelect,
  selectionMode = 'single',
  selectedModelRef = null,
  selectedModelRefs,
  emptyMessage,
  disabled = false,
  className,
  variant = 'popover',
  widthClassName,
  maxHeightClassName,
  autoFocusSearch = false,
  onSearchKeyDown,
  footer,
}: ModelPickerPanelProps) {
  const filteredCatalog = useMemo(() => filterModelCatalog(catalog, search), [catalog, search])
  const groupedModels = useMemo(() => groupModelCatalogByProvider(filteredCatalog), [filteredCatalog])

  function isModelSelected(modelRef: string): boolean {
    if (selectionMode === 'multi') {
      return selectedModelRefs?.has(modelRef) ?? false
    }
    return selectedModelRef === modelRef
  }

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden bg-popover text-popover-foreground',
        variant === 'embedded' ? 'rounded-none border-0 shadow-none' : 'ui-popover-panel',
        widthClassName ?? 'w-72',
        maxHeightClassName ?? 'max-h-80',
        className,
      )}
    >
      <div className="shrink-0 border-b border-border/60 px-1 py-1">
        <Input
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          disabled={disabled}
          autoFocus={autoFocusSearch}
          className="h-7 border-0 bg-transparent px-0 py-0 leading-tight shadow-none focus-visible:ring-0"
          onKeyDown={onSearchKeyDown}
        />
      </div>

      {quickOptions && quickOptions.length > 0 ? (
        <>
          <div className="shrink-0 ui-popover-list">
            {quickOptions.map(option => (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => onQuickOptionSelect?.(option.id)}
                className={cn('ui-menu-item w-full hover:bg-accent hover:text-accent-foreground', option.selected && 'bg-accent text-foreground')}
              >
                <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
                {option.selected ? <Check className="size-3.5 shrink-0 text-foreground" strokeWidth={2} /> : null}
              </button>
            ))}
          </div>
          <div className="shrink-0 border-t border-border/60" role="separator" />
        </>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto ui-popover-list">
        {groupedModels.length === 0 ? (
          <p className="py-menu-y text-center text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          groupedModels.map(([providerId, group]) => (
            <div key={providerId} className="flex flex-col gap-stack-sm">
              <p className="ui-popover-label">{group.providerName}</p>
              {group.items.map(item => {
                const selected = isModelSelected(item.modelRef)
                return (
                  <button
                    key={item.modelRef}
                    type="button"
                    disabled={disabled}
                    onClick={() => onModelSelect(item.modelRef)}
                    className={cn('ui-menu-item w-full hover:bg-accent hover:text-accent-foreground', selected && 'bg-accent text-foreground')}
                  >
                    <span className="min-w-0 flex-1 truncate text-left">{item.modelName}</span>
                    {selected ? <Check className="size-3.5 shrink-0 text-foreground" strokeWidth={2} /> : null}
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>

      {footer ? (
        <>
          <div className="shrink-0 border-t border-border/60" role="separator" />
          <div className="shrink-0 ui-popover-list">{footer}</div>
        </>
      ) : null}
    </div>
  )
}
