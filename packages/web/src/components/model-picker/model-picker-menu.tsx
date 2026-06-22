import { type ReactNode } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ModelPickerPanel, type ModelPickerPanelProps, type ModelPickerQuickOption } from '@/components/model-picker/model-picker-panel'

export type { ModelPickerQuickOption }
export interface ModelPickerMenuProps extends ModelPickerPanelProps {
  trigger: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  /** 下拉宽度与 trigger 对齐（模型组「选择模型」） */
  matchTriggerWidth?: boolean
  /** 选中后是否关闭；多选模型池设为 false */
  closeOnSelect?: boolean
}

export function ModelPickerMenu({
  trigger,
  open,
  onOpenChange,
  align = 'start',
  sideOffset = 4,
  matchTriggerWidth = false,
  closeOnSelect = true,
  onQuickOptionSelect,
  onModelSelect,
  variant = 'popover',
  onSearchChange,
  ...panelProps
}: ModelPickerMenuProps) {
  function handleOpenChange(nextOpen: boolean) {
    onOpenChange?.(nextOpen)
    if (!nextOpen) {
      onSearchChange('')
    }
  }

  function handleQuickOptionSelect(id: string) {
    onQuickOptionSelect?.(id)
    if (closeOnSelect) {
      onOpenChange?.(false)
    }
  }

  function handleModelSelect(modelRef: string) {
    onModelSelect(modelRef)
    if (closeOnSelect) {
      onOpenChange?.(false)
    }
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild disabled={panelProps.disabled}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        sideOffset={sideOffset}
        onCloseAutoFocus={event => event.preventDefault()}
        className={cn(
          'z-50 overflow-visible border-0 bg-transparent p-0 shadow-none',
          matchTriggerWidth && 'min-w-[var(--radix-dropdown-menu-trigger-width)] w-[var(--radix-dropdown-menu-trigger-width)]',
        )}
      >
        <ModelPickerPanel
          {...panelProps}
          variant={variant}
          onSearchChange={onSearchChange}
          onQuickOptionSelect={handleQuickOptionSelect}
          onModelSelect={handleModelSelect}
          widthClassName={matchTriggerWidth ? 'w-full' : panelProps.widthClassName}
          maxHeightClassName={panelProps.maxHeightClassName ?? (variant === 'embedded' ? 'max-h-64' : undefined)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
