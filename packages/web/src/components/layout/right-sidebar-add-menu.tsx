import { Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import { resolveRightSidebarActions } from '@/constants/right-sidebar-actions'
import { useTranslation } from '@/hooks/use-translation'
import { useRightSidebarPanelStore } from '@/stores/right-sidebar-panel'
import { cn } from '@/utils/cn'
import { useLocation } from 'react-router-dom'

export function RightSidebarAddMenu() {
  const { pathname } = useLocation()
  const { t } = useTranslation('layout')
  const activePanel = useRightSidebarPanelStore((state) => state.activePanel)
  const togglePanel = useRightSidebarPanelStore((state) => state.togglePanel)
  const actions = resolveRightSidebarActions(pathname)

  if (actions.length === 0) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton type="button" aria-label={t('rightSidebar.addMenu')}>
          <Plus className="size-4" strokeWidth={1.75} />
        </IconButton>
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
