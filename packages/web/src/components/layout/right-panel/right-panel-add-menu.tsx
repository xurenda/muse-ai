import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RIGHT_PANEL_TAB_DEFINITIONS } from '@/constants/right-panel-tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import { useRightPanelStore } from '@/stores/right-panel'

export function RightPanelAddMenu() {
  const { t } = useTranslation('layout')
  const tabs = useRightPanelStore(state => state.tabs)
  const availableTabTypes = useRightPanelStore(state => state.availableTabTypes)
  const addTab = useRightPanelStore(state => state.addTab)
  const addableTypes = availableTabTypes.filter(type => !tabs.some(tab => tab.type === type))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          type="button"
          aria-label={t('rightPanel.addTab')}
          disabled={addableTypes.length === 0}
          className="shrink-0"
          tooltip={t('rightPanel.addTab')}
        >
          <Plus className="size-4" strokeWidth={1.75} />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {addableTypes.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">{t('rightPanel.noAddableTabs')}</div>
        ) : (
          addableTypes.map(type => {
            const definition = RIGHT_PANEL_TAB_DEFINITIONS[type]
            const Icon = definition.icon
            return (
              <DropdownMenuItem key={type} onSelect={() => addTab(type)}>
                <Icon className="size-3.5" strokeWidth={2} />
                {t(definition.labelKey)}
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
