import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SettingsNavLink } from '@/components/layout/settings-nav-link'
import { SidebarToolbar } from '@/components/layout/sidebar-toolbar'
import { settingsNavItems } from '@/constants/settings-nav'
import { useTranslation } from '@/hooks/use-translation'

interface SettingsSidebarProps {
  open: boolean
  onToggle: () => void
}

export function SettingsSidebar({ open, onToggle }: SettingsSidebarProps) {
  const { t } = useTranslation('settings')

  return (
    <aside className="flex h-full flex-col">
      <SidebarToolbar open={open} onToggle={onToggle} />
      <nav className="flex flex-col px-2 pb-3">
        <Link
          to="/new-chat"
          className="ui-menu-item rounded-lg text-sidebar-foreground hover:bg-sidebar-accent/60"
        >
          <ChevronLeft className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
          <span>{t('back')}</span>
        </Link>
        <div className="mt-4 flex flex-col gap-0.5">
          {settingsNavItems.map((item) => (
            <SettingsNavLink
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={t(item.labelKey)}
              end={'end' in item ? item.end : undefined}
            />
          ))}
        </div>
      </nav>
    </aside>
  )
}
