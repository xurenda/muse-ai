import type { HeaderItem } from '@/constants/app-header'
import { SidebarToggle } from '@/components/layout/sidebar-toggle'
import { SettingsMenu } from '@/components/layout/settings-menu'

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
      className={
        sidebarOpen
          ? 'flex h-11 shrink-0 items-center justify-end px-3'
          : 'flex h-11 shrink-0 items-center justify-between px-3'
      }
    >
      {!sidebarOpen ? <SidebarToggle open={false} onToggle={onSidebarToggle} /> : null}
      <div className="flex items-center gap-1">{right.map(renderItem)}</div>
    </header>
  )
}
