import type { HeaderItem } from '@/constants/app-header'
import { DaemonStatus } from '@/components/layout/daemon-status'
import { RightSidebarToggle } from '@/components/layout/right-sidebar-toggle'
import { SettingsMenu } from '@/components/layout/settings-menu'
import { cn } from '@/utils/cn'

interface HeaderActionsProps {
  right?: HeaderItem[]
  rightSidebarToggle?: {
    open: boolean
    onToggle: () => void
  }
  className?: string
}

function renderHeaderItem(item: HeaderItem) {
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

export function HeaderActions({ right = [], rightSidebarToggle, className }: HeaderActionsProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <DaemonStatus />
      {right.map(renderHeaderItem)}
      {rightSidebarToggle ? (
        <RightSidebarToggle
          open={rightSidebarToggle.open}
          onToggle={rightSidebarToggle.onToggle}
        />
      ) : null}
    </div>
  )
}
