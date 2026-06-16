import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/language-switcher'
import { SessionTreeToggle } from '@/components/layout/session-tree-toggle'
import { SidebarToggle } from '@/components/layout/sidebar-toggle'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

interface MainHeaderProps {
  sidebarOpen: boolean
  onSidebarToggle: () => void
  sessionTreeOpen: boolean
  onSessionTreeToggle: () => void
  showSessionTreeToggle: boolean
}

export function MainHeader({ sidebarOpen, onSidebarToggle, sessionTreeOpen, onSessionTreeToggle, showSessionTreeToggle }: MainHeaderProps) {
  const { t } = useTranslation('layout')
  const { t: ta } = useTranslation('auth')
  const { deviceSession, logout } = useAuth()

  return (
    <header
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-10 flex h-11 items-center bg-transparent px-3',
        sidebarOpen ? 'justify-between' : 'justify-between',
      )}
    >
      <div className="app-region-no-drag pointer-events-auto flex items-center gap-1">
        {!sidebarOpen ? <SidebarToggle open={false} onToggle={onSidebarToggle} /> : null}
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/devices">{deviceSession ? t('header.deviceConnected', { name: deviceSession.deviceName }) : t('header.deviceDisconnected')}</Link>
        </Button>
      </div>

      <div className="app-region-no-drag pointer-events-auto flex items-center gap-2">
        <LanguageSwitcher />
        {showSessionTreeToggle && !sessionTreeOpen ? <SessionTreeToggle open={false} onToggle={onSessionTreeToggle} /> : null}
        <Button type="button" variant="ghost" size="sm" onClick={logout}>
          {ta('logout')}
        </Button>
      </div>
    </header>
  )
}
