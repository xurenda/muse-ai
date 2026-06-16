import type { SidebarItem } from '@/constants/app-sidebar'
import { SessionList } from '@/components/chat/session-list'
import { SidebarNavLink } from '@/components/layout/sidebar-nav-link'
import { SidebarToolbar } from '@/components/layout/sidebar-toolbar'
import { SidebarUserMenu } from '@/components/layout/sidebar-user-menu'
import { useSessionList } from '@/hooks/use-session-list'
import { useTranslation } from 'react-i18next'

interface AppSidebarProps {
  items: readonly SidebarItem[]
  open: boolean
  onToggle: () => void
}

export function AppSidebar({ items, open, onToggle }: AppSidebarProps) {
  const { t } = useTranslation('layout')
  const { sessions, isLoading, error, refresh } = useSessionList()

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <SidebarToolbar open={open} onToggle={onToggle} />
      <nav className="flex flex-col gap-0.5 px-2 pb-2">
        {items.map(item => (
          <SidebarNavLink key={item.to} to={item.to} icon={item.icon} label={t(item.labelKey)} end={item.end} />
        ))}
      </nav>
      <SessionList sessions={sessions} isLoading={isLoading} error={error} onRefresh={refresh} />
      <SidebarUserMenu />
    </aside>
  )
}
