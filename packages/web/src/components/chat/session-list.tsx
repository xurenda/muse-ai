import type { SessionMeta } from '@muse-ai/shared'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface SessionListProps {
  sessions: SessionMeta[]
  isLoading: boolean
  error: string | null
}

function getSessionLabel(session: SessionMeta, untitledLabel: string): string {
  if (session.name?.trim()) {
    return session.name.trim()
  }
  return `${untitledLabel} ${session.id.slice(0, 8)}`
}

export function SessionList({ sessions, isLoading, error }: SessionListProps) {
  const { t } = useTranslation('layout')

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 pb-3">
      <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{t('sidebar.sessions')}</p>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {isLoading ? <p className="px-2 py-1 text-xs text-muted-foreground">{t('sidebar.sessionsLoading')}</p> : null}

        {!isLoading && error ? <p className="px-2 py-1 text-xs text-destructive">{error}</p> : null}

        {!isLoading && !error && sessions.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">{t('sidebar.sessionsEmpty')}</p> : null}

        {sessions.map(session => (
          <NavLink
            key={session.id}
            to={`/chat/${session.id}`}
            className={({ isActive }) =>
              cn(
                'ui-menu-item rounded-lg',
                isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
              )
            }
          >
            <span className="truncate">{getSessionLabel(session, t('sidebar.untitledSession'))}</span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}
