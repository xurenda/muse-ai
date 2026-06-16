import { SidebarToggle } from '@/components/layout/sidebar-toggle'

interface SidebarToolbarProps {
  open: boolean
  onToggle: () => void
}

export function SidebarToolbar({ open, onToggle }: SidebarToolbarProps) {
  return (
    <div className="flex h-11 shrink-0 items-center px-2.5">
      <SidebarToggle open={open} onToggle={onToggle} />
    </div>
  )
}
