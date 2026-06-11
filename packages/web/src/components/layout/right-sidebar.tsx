import type { HeaderItem } from '@/constants/app-header'
import { RightSidebarContent } from '@/components/layout/right-sidebar-content'
import { RightSidebarToolbar } from '@/components/layout/right-sidebar-toolbar'

interface RightSidebarProps {
  open: boolean
  onToggle: () => void
  right?: HeaderItem[]
}

export function RightSidebar({ open, onToggle, right = [] }: RightSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col bg-background">
      <RightSidebarToolbar open={open} onToggle={onToggle} right={right} />
      <RightSidebarContent />
    </aside>
  )
}
