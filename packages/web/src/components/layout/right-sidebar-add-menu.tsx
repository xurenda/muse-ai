import { ChevronDown, Plus, RefreshCw } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import type { RightSidebarPanelId } from '@/constants/right-sidebar-actions'
import { resolveRightSidebarActions } from '@/constants/right-sidebar-actions'
import { useTranslation } from '@/hooks/use-translation'
import { useRightSidebarPanelStore } from '@/stores/right-sidebar-panel'
import { cn } from '@/utils/cn'
import { useLocation } from 'react-router-dom'

function resolveActivePanelLabel(panel: RightSidebarPanelId, tChat: (key: string) => string): string {
  if (panel === 'trace') {
    return tChat('trace.title')
  }

  return panel
}

export function RightSidebarAddMenu() {
  const { pathname } = useLocation()
  const { t } = useTranslation('layout')
  const { t: tChat } = useTranslation('chat')
  const activePanel = useRightSidebarPanelStore((state) => state.activePanel)
  const togglePanel = useRightSidebarPanelStore((state) => state.togglePanel)
  const actions = resolveRightSidebarActions(pathname)

  if (actions.length === 0) {
    return null
  }

  const activeLabel = activePanel ? resolveActivePanelLabel(activePanel, tChat) : null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {activeLabel ? (
          <button
            type="button"
            className={cn(
              'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-sm font-medium text-foreground transition-colors outline-none',
              'hover:bg-foreground/6 data-[state=open]:bg-foreground/6',
            )}
            aria-label={t('rightSidebar.panelMenu', { panel: activeLabel })}
          >
            {activeLabel}
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={2} />
          </button>
        ) : (
          <IconButton type="button" aria-label={t('rightSidebar.addMenu')}>
            <Plus className="size-4" strokeWidth={1.75} />
          </IconButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.id}
            className={cn(activePanel === action.id && 'bg-accent text-accent-foreground')}
            onClick={() => togglePanel(action.id)}
          >
            {t(action.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function RightSidebarPanelRefresh() {
  const { t } = useTranslation('chat')
  const activePanel = useRightSidebarPanelStore((state) => state.activePanel)
  const panelRefresh = useRightSidebarPanelStore((state) => state.panelRefresh)

  if (activePanel !== 'trace' || !panelRefresh) {
    return null
  }

  return (
    <IconButton type="button" aria-label={t('trace.refresh')} onClick={() => void panelRefresh()}>
      <RefreshCw className="size-4 shrink-0" strokeWidth={1.5} />
    </IconButton>
  )
}
