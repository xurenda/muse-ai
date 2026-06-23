import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RIGHT_PANEL_TAB_DEFINITIONS } from '@/constants/right-panel-tabs'
import { IconButton } from '@/components/ui/icon-button'
import { useRightPanelStore } from '@/stores/right-panel'
import { cn } from '@/lib/utils'

export function RightPanelTabList() {
  const { t } = useTranslation('layout')
  const tabs = useRightPanelStore(state => state.tabs)
  const activeTabId = useRightPanelStore(state => state.activeTabId)
  const setActiveTab = useRightPanelStore(state => state.setActiveTab)
  const removeTab = useRightPanelStore(state => state.removeTab)

  if (tabs.length === 0) return null

  return (
    <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
      {tabs.map(tab => {
        const definition = RIGHT_PANEL_TAB_DEFINITIONS[tab.type]
        const Icon = definition.icon
        const active = tab.id === activeTabId
        const label = t(definition.labelKey)

        return (
          <div
            key={tab.id}
            className={cn(
              'group flex shrink-0 items-center rounded-md',
              active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <IconButton asChild tooltip={label}>
              <button type="button" className="flex size-7 items-center justify-center" aria-label={label} onClick={() => setActiveTab(tab.id)}>
                <Icon className="size-3.5" strokeWidth={2} />
              </button>
            </IconButton>
            <IconButton
              type="button"
              className="size-6 opacity-0 group-hover:opacity-100"
              aria-label={t('rightPanel.closeTab')}
              tooltip={t('rightPanel.closeTab')}
              onClick={() => removeTab(tab.id)}
            >
              <X className="size-3" strokeWidth={2} />
            </IconButton>
          </div>
        )
      })}
    </div>
  )
}
