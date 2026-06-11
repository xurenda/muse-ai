import { ChevronDown } from 'lucide-react'
import { useEffect } from 'react'
import { TraceEntrySection } from '@/components/chat/trace-entry-section'
import { Button } from '@/components/ui/button'
import { useSessionTraces } from '@/hooks/use-session-traces'
import { useTranslation } from '@/hooks/use-translation'
import type { SessionTraceSummary } from '@muse-ai/shared'
import { useRightSidebarPanelStore } from '@/stores/right-sidebar-panel'
import { formatTraceTimestamp, serializeTraceTurn } from '@/utils/trace-format'
import { cn } from '@/utils/cn'
import { toast } from 'sonner'

interface TracePanelProps {
  sessionId: string
  isSending: boolean
}

function formatTurnSummary(trace: SessionTraceSummary, t: (key: string, values?: Record<string, string | number>) => string, locale: string): string {
  const time = trace.updatedAt ? formatTraceTimestamp(trace.updatedAt, locale) : '—'

  if (trace.modelLabel) {
    return t('trace.turnMetaWithModel', {
      count: trace.entryCount,
      model: trace.modelLabel,
      time,
    })
  }

  return t('trace.turnMeta', {
    count: trace.entryCount,
    time,
  })
}

function downloadTraceTurn(sessionId: string, turnIndex: number, content: string): void {
  const blob = new Blob([content], { type: 'application/x-ndjson' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${sessionId}-turn-${turnIndex}-trace.jsonl`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function TracePanel({ sessionId, isSending }: TracePanelProps) {
  const { t, locale } = useTranslation('chat')
  const setPanelRefresh = useRightSidebarPanelStore((state) => state.setPanelRefresh)
  const { list, detail, selectedTurnIndex, setSelectedTurnIndex, isLoadingList, isLoadingDetail, error, refreshList } =
    useSessionTraces({
      sessionId,
      enabled: true,
      isSending,
    })

  useEffect(() => {
    setPanelRefresh(() => {
      void refreshList()
    })
    return () => {
      setPanelRefresh(null)
    }
  }, [refreshList, setPanelRefresh])

  const handleCopyTurn = async () => {
    if (!detail) {
      return
    }

    try {
      await navigator.clipboard.writeText(serializeTraceTurn(detail))
      toast.success(t('trace.copied'))
    } catch {
      toast.error(t('trace.copyFailed'))
    }
  }

  const handleExportTurn = () => {
    if (!detail) {
      return
    }

    const content = serializeTraceTurn(detail)
    if (content.length === 0) {
      return
    }

    downloadTraceTurn(detail.sessionId, detail.turnIndex, content)
    toast.success(t('trace.exported'))
  }

  const handleTurnToggle = (turnIndex: number) => {
    setSelectedTurnIndex(selectedTurnIndex === turnIndex ? null : turnIndex)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {error ? <p className="px-3 py-2 text-xs text-destructive">{error}</p> : null}

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
        {isLoadingList ? <p className="px-1 text-xs text-muted-foreground">{t('trace.loading')}</p> : null}

        {!isLoadingList && (list?.traces.length ?? 0) === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">{t('trace.empty')}</p>
        ) : null}

        {list?.traces.map((trace) => {
          const expanded = selectedTurnIndex === trace.turnIndex
          const showDetail = expanded && detail?.turnIndex === trace.turnIndex

          return (
            <div key={trace.turnIndex} className="flex flex-col">
              <button
                type="button"
                className={cn(
                  'ui-menu-item w-full text-left',
                  expanded ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-muted-foreground hover:bg-muted',
                )}
                onClick={() => handleTurnToggle(trace.turnIndex)}
              >
                <span className="flex items-start gap-2">
                  <ChevronDown
                    className={cn(
                      'mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform',
                      !expanded && '-rotate-90',
                    )}
                    strokeWidth={2}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium">{t('trace.turnLabel', { index: trace.turnIndex })}</span>
                    <span className="mt-0.5 block text-[10px] leading-snug opacity-80">
                      {formatTurnSummary(trace, t, locale)}
                    </span>
                  </span>
                </span>
              </button>

              {expanded ? (
                <div className="flex flex-col gap-2 border-b border-border px-1 pb-3 pt-1">
                  {showDetail ? (
                    <div className="flex items-center gap-1 px-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyTurn()}>
                        {t('trace.copyTurn')}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleExportTurn}>
                        {t('trace.exportTurn')}
                      </Button>
                    </div>
                  ) : null}

                  {isLoadingDetail && !showDetail ? (
                    <p className="px-1 text-xs text-muted-foreground">{t('trace.loading')}</p>
                  ) : null}

                  {showDetail ? (
                    <div className="flex flex-col gap-3 px-1">
                      {detail.entries.map((entry, index) => (
                        <TraceEntrySection key={`${entry.type}-${entry.timestamp}-${index}`} entry={entry} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
