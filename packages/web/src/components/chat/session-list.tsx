import type { SessionMeta } from '@muse-ai/shared'
import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { deleteCliSession, patchCliSession } from '@/api/cli-client'
import { SessionDeleteDialog } from '@/components/chat/session-delete-dialog'
import { SessionRenameDialog } from '@/components/chat/session-rename-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

interface SessionListProps {
  sessions: SessionMeta[]
  isLoading: boolean
  error: string | null
  onRefresh: () => Promise<void>
}

function getSessionLabel(session: SessionMeta, newChatLabel: string): string {
  if (session.name?.trim()) {
    return session.name.trim()
  }
  return newChatLabel
}

export function SessionList({ sessions, isLoading, error, onRefresh }: SessionListProps) {
  const { t } = useTranslation('layout')
  const { deviceSession } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [renameTarget, setRenameTarget] = useState<SessionMeta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SessionMeta | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const handleSessionMenuOpenChange = (sessionId: string, open: boolean) => {
    setOpenMenuId(open ? sessionId : null)
    if (!open) {
      queueMicrotask(() => {
        const activeElement = document.activeElement
        if (activeElement instanceof HTMLElement) {
          activeElement.blur()
        }
      })
    }
  }

  const handleRename = async (name: string) => {
    if (!deviceSession || !renameTarget) return
    await patchCliSession(deviceSession.endpoint, deviceSession.accessToken, renameTarget.id, name)
    await onRefresh()
  }

  const handleDelete = async () => {
    if (!deviceSession || !deleteTarget) return
    await deleteCliSession(deviceSession.endpoint, deviceSession.accessToken, deleteTarget.id)
    if (pathname === `/chat/${deleteTarget.id}`) {
      navigate('/chat')
    }
    await onRefresh()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 pb-3">
      <p className="px-2 pb-1 text-xs font-medium text-muted-foreground">{t('sidebar.sessions')}</p>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {isLoading ? <p className="px-2 py-1 text-xs text-muted-foreground">{t('sidebar.sessionsLoading')}</p> : null}

        {!isLoading && error ? <p className="px-2 py-1 text-xs text-destructive">{error}</p> : null}

        {!isLoading && !error && sessions.length === 0 ? <p className="px-2 py-1 text-xs text-muted-foreground">{t('sidebar.sessionsEmpty')}</p> : null}

        {sessions.map(session => {
          const label = getSessionLabel(session, t('sidebar.newChat'))
          const isActive = pathname === `/chat/${session.id}`
          return (
            <div
              key={session.id}
              className={cn(
                'group flex min-w-0 items-center rounded-lg',
                isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
              )}
            >
              <NavLink to={`/chat/${session.id}`} className="ui-menu-item min-w-0 flex-1 rounded-lg bg-transparent hover:bg-transparent">
                <span className="truncate">{label}</span>
              </NavLink>

              <DropdownMenu open={openMenuId === session.id} onOpenChange={open => handleSessionMenuOpenChange(session.id, open)}>
                <DropdownMenuTrigger asChild>
                  <IconButton
                    type="button"
                    className={cn('mr-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100', openMenuId === session.id && 'opacity-100')}
                    aria-label={t('sidebar.sessionActions')}
                    onClick={event => event.preventDefault()}
                  >
                    <MoreHorizontal className="size-3.5" strokeWidth={2} />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom">
                  <DropdownMenuItem
                    onSelect={() => {
                      setRenameTarget(session)
                    }}
                  >
                    {t('sidebar.renameSession')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      setDeleteTarget(session)
                    }}
                  >
                    {t('sidebar.deleteSession')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>

      <SessionRenameDialog
        key={renameTarget?.id ?? 'closed'}
        open={renameTarget !== null}
        initialName={renameTarget ? getSessionLabel(renameTarget, t('sidebar.newChat')) : ''}
        onOpenChange={open => {
          if (!open) setRenameTarget(null)
        }}
        onConfirm={handleRename}
      />

      <SessionDeleteDialog
        open={deleteTarget !== null}
        sessionName={deleteTarget ? getSessionLabel(deleteTarget, t('sidebar.newChat')) : ''}
        onOpenChange={open => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={handleDelete}
      />
    </div>
  )
}
