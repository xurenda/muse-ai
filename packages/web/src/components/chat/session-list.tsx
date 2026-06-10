import type { SessionMeta } from '@muse-ai/shared'
import { Trash2 } from 'lucide-react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { IconButton } from '@/components/ui/icon-button'
import { useTranslation } from '@/hooks/use-translation'
import { deleteSession } from '@/services/session-api'
import { cn } from '@/utils/cn'

interface SessionListProps {
  sessions: SessionMeta[]
  isLoading: boolean
  error: string | null
  onRefresh: () => Promise<void>
}

function getSessionLabel(session: SessionMeta, untitledLabel: string): string {
  if (session.title?.trim()) {
    return session.title.trim()
  }
  return `${untitledLabel} ${session.id.slice(0, 8)}`
}

export function SessionList({ sessions, isLoading, error, onRefresh }: SessionListProps) {
  const { t } = useTranslation('layout')
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleDelete = async (sessionId: string) => {
    await deleteSession(sessionId)
    if (pathname === `/chat/${sessionId}`) {
      navigate('/new-chat')
    }
    await onRefresh()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 pb-3">
      <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{t('sidebar.sessions')}</p>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {isLoading ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">{t('sidebar.sessionsLoading')}</p>
        ) : null}

        {!isLoading && error ? (
          <p className="px-2 py-1 text-xs text-destructive">{error}</p>
        ) : null}

        {!isLoading && !error && sessions.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">{t('sidebar.sessionsEmpty')}</p>
        ) : null}

        {sessions.map((session) => (
          <div key={session.id} className="group flex items-center gap-0.5">
            <NavLink
              to={`/chat/${session.id}`}
              className={({ isActive }) =>
                cn(
                  'ui-menu-item min-w-0 flex-1 rounded-lg',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
                )
              }
            >
              <span className="truncate">{getSessionLabel(session, t('sidebar.untitledSession'))}</span>
            </NavLink>
            <IconButton
              type="button"
              className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              aria-label={t('sidebar.deleteSession')}
              onClick={() => {
                void handleDelete(session.id)
              }}
            >
              <Trash2 className="size-3.5" strokeWidth={2} />
            </IconButton>
          </div>
        ))}
      </div>
    </div>
  )
}
