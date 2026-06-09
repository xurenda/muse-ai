import type { SidebarItem } from '@/constants/app-sidebar'
import { SidebarNavLink } from '@/components/layout/sidebar-nav-link'
import { useTranslation } from '@/hooks/use-translation'

interface AppSidebarProps {
  items: SidebarItem[]
}

export function AppSidebar({ items }: AppSidebarProps) {
  const { t } = useTranslation('layout')

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <nav className="flex flex-col gap-0.5 p-3">
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
