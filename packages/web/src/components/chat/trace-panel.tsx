import { useEffect } from 'react'
import { JsonTreeView } from '@/components/chat/json-tree-view'
import { useSessionTrace } from '@/hooks/use-session-trace'
import { useTranslation } from '@/hooks/use-translation'
import { useRightSidebarPanelStore } from '@/stores/right-sidebar-panel'

interface TracePanelProps {
  sessionId: string
  isSending: boolean
}

export function TracePanel({ sessionId, isSending }: TracePanelProps) {
  const { t } = useTranslation('chat')
  const setPanelRefresh = useRightSidebarPanelStore((state) => state.setPanelRefresh)
  const { trace, isLoading, error, refresh } = useSessionTrace({
    sessionId,
    enabled: true,
    isSending,
  })

  useEffect(() => {
    setPanelRefresh(() => {
      void refresh()
    })
    return () => {
      setPanelRefresh(null)
    }
  }, [refresh, setPanelRefresh])

  const hasTrace = trace?.request !== undefined || trace?.response !== undefined

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {error ? <p className="px-3 py-2 text-xs text-destructive">{error}</p> : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        {isLoading ? <p className="px-1 text-xs text-muted-foreground">{t('trace.loading')}</p> : null}

        {!isLoading && !hasTrace ? (
          <p className="px-1 text-xs text-muted-foreground">{t('trace.empty')}</p>
        ) : null}

        {trace?.request !== undefined ? (
          <div
            className={
              trace?.response !== undefined ? 'border-b border-border pb-3' : undefined
            }
          >
            <JsonTreeView value={trace.request} collapsed={2} />
          </div>
        ) : null}

        {trace?.response !== undefined ? (
          <div className={trace?.request !== undefined ? 'pt-3' : undefined}>
            <JsonTreeView value={trace.response} collapsed={2} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
