import type { HeaderItem } from '@/constants/app-header'
import { DaemonStatus } from '@/components/layout/daemon-status'
import { SidebarToggle } from '@/components/layout/sidebar-toggle'
import { SettingsMenu } from '@/components/layout/settings-menu'
import { cn } from '@/utils/cn'

interface MainHeaderProps {
  sidebarOpen: boolean
  onSidebarToggle: () => void
  right?: HeaderItem[]
}

export function MainHeader({
  sidebarOpen,
  onSidebarToggle,
  right = [],
}: MainHeaderProps) {
  const renderItem = (item: HeaderItem) => {
    if (item.kind === 'menu' && item.menu === 'settings') {
      return (
        <SettingsMenu
          key={item.menu}
          labelKey={item.labelKey}
          icon={item.icon}
        />
      )
    }
    return null
  }

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
      <div className="app-region-no-drag pointer-events-auto flex items-center gap-1">
        <DaemonStatus />
        {right.map(renderItem)}
      </div>
    </header>
  )
}
