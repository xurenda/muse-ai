import type { SidebarItem } from '@/constants/app-sidebar'
import { SidebarNavLink } from '@/components/layout/sidebar-nav-link'
import { SidebarToolbar } from '@/components/layout/sidebar-toolbar'
import { useTranslation } from '@/hooks/use-translation'

interface AppSidebarProps {
  items: SidebarItem[]
  open: boolean
  onToggle: () => void
}

export function AppSidebar({ items, open, onToggle }: AppSidebarProps) {
  const { t } = useTranslation('layout')

  return (
    <aside className="flex h-full flex-col">
      <SidebarToolbar open={open} onToggle={onToggle} />
      <nav className="flex flex-col gap-0.5 px-2 pb-3">
        {items.map((item) => (
          <SidebarNavLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={t(item.labelKey)}
            end={item.end}
          />
        ))}
      </nav>
    </aside>
  )
}
