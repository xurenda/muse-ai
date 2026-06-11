import type { HeaderItem } from '@/constants/app-header'
import { HeaderActions } from '@/components/layout/header-actions'
import { SidebarToggle } from '@/components/layout/sidebar-toggle'
import { cn } from '@/utils/cn'

interface MainHeaderProps {
  sidebarOpen: boolean
  onSidebarToggle: () => void
  rightSidebarOpen: boolean
  onRightSidebarToggle: () => void
  right?: HeaderItem[]
}

export function MainHeader({
  sidebarOpen,
  onSidebarToggle,
  rightSidebarOpen,
  onRightSidebarToggle,
  right = [],
}: MainHeaderProps) {
  return (
    <header
      className={cn(
        'app-region-drag pointer-events-none absolute inset-x-0 top-0 z-10 flex h-11 items-center bg-transparent px-3',
        sidebarOpen ? 'justify-end' : 'justify-between',
      )}
    >
      {!sidebarOpen ? (
        <SidebarToggle
          open={false}
          onToggle={onSidebarToggle}
          className="app-region-no-drag pointer-events-auto"
        />
      ) : null}
      {!rightSidebarOpen ? (
        <div className="app-region-no-drag pointer-events-auto flex items-center gap-1">
          <HeaderActions
            right={right}
            rightSidebarToggle={{ open: false, onToggle: onRightSidebarToggle }}
          />
        </div>
      ) : null}
    </header>
  )
}
