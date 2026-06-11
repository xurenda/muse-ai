import type { HeaderItem } from '@/constants/app-header'
import { HeaderActions } from '@/components/layout/header-actions'
import { RightSidebarAddMenu } from '@/components/layout/right-sidebar-add-menu'

interface RightSidebarToolbarProps {
  open: boolean
  onToggle: () => void
  right?: HeaderItem[]
}

export function RightSidebarToolbar({ open, onToggle, right = [] }: RightSidebarToolbarProps) {
  return (
    <div className="flex h-11 shrink-0 items-center px-2.5">
      <RightSidebarAddMenu />
      <HeaderActions
        className="ml-auto"
        right={right}
        rightSidebarToggle={{ open, onToggle }}
      />
    </div>
  )
}
