import { useTranslation } from 'react-i18next'
import type { SessionMeta } from '@muse-ai/shared'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SessionSidebarProps {
  sessions: SessionMeta[]
  activeSessionId: string | null
  disabled: boolean
  onSelect: (sessionId: string) => void
  onNew: () => void
}

function formatSessionTitle(session: SessionMeta): string {
  if (session.name?.trim()) return session.name.trim()
  return session.id.slice(0, 8)
}

export function SessionSidebar({ sessions, activeSessionId, disabled, onSelect, onNew }: SessionSidebarProps) {
  const { t } = useTranslation('chat')

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-medium">{t('sessionListTitle')}</h2>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onNew}>
          {t('newSession')}
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">{t('sessionListEmpty')}</p>
        ) : (
          <ul className="space-y-1">
            {sessions.map(session => (
              <li key={session.id}>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(
                    'w-full rounded-md px-2 py-2 text-left text-sm transition-colors',
                    session.id === activeSessionId ? 'bg-primary/15 text-primary' : 'hover:bg-muted/60',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                  onClick={() => onSelect(session.id)}
                >
                  <p className="truncate font-medium">{formatSessionTitle(session)}</p>
                  <p className="truncate font-mono text-[10px] text-muted-foreground">{session.id.slice(0, 8)}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
