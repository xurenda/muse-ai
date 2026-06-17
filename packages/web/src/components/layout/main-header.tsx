import { RightPanelToggle } from '@/components/layout/right-panel-toggle'
import { SidebarToggle } from '@/components/layout/sidebar-toggle'
import { useRightPanelStore } from '@/stores/right-panel'
import { cn } from '@/lib/utils'

interface MainHeaderProps {
  sidebarOpen: boolean
  onSidebarToggle: () => void
}

export function MainHeader({ sidebarOpen, onSidebarToggle }: MainHeaderProps) {
  const rightPanelOpen = useRightPanelStore(state => state.open)
  const setRightPanelOpen = useRightPanelStore(state => state.setOpen)

  return (
    <header className={cn('pointer-events-none absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-between bg-transparent px-3')}>
      <div className="app-region-no-drag pointer-events-auto flex items-center gap-1">
        {!sidebarOpen ? <SidebarToggle open={false} onToggle={onSidebarToggle} /> : null}
      </div>

      {!rightPanelOpen ? (
        <div className="app-region-no-drag pointer-events-auto">
          <RightPanelToggle open={false} onToggle={() => setRightPanelOpen(true)} />
        </div>
      ) : null}
    </header>
  )
}
