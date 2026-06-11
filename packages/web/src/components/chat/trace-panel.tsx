import { TraceEntrySection } from '@/components/chat/trace-entry-section'
import { Button } from '@/components/ui/button'
import { useSessionTraces } from '@/hooks/use-session-traces'
import { useTranslation } from '@/hooks/use-translation'
import type { SessionTraceSummary } from '@muse-ai/shared'
import { formatTraceTimestamp, serializeTraceTurn } from '@/utils/trace-format'
import { cn } from '@/utils/cn'
import { toast } from 'sonner'

interface TracePanelProps {
  sessionId: string
  isSending: boolean
  onClose: () => void
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

export function TracePanel({ sessionId, isSending, onClose }: TracePanelProps) {
  const { t, locale } = useTranslation('chat')
  const { list, detail, selectedTurnIndex, setSelectedTurnIndex, isLoadingList, isLoadingDetail, error, refreshList } =
    useSessionTraces({
      sessionId,
      enabled: true,
      isSending,
    })

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

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-medium">{t('trace.title')}</h2>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => void refreshList()}>
            {t('trace.refresh')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('trace.close')}
          </Button>
        </div>
      </div>

      {error ? <p className="px-3 py-2 text-xs text-destructive">{error}</p> : null}

      <div className="flex min-h-0 flex-1">
        <div className="flex w-40 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border p-2">
          {isLoadingList ? <p className="px-1 text-xs text-muted-foreground">{t('trace.loading')}</p> : null}

          {!isLoadingList && (list?.traces.length ?? 0) === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">{t('trace.empty')}</p>
          ) : null}

          {list?.traces.map((trace) => (
            <button
              key={trace.turnIndex}
              type="button"
              className={cn(
                'ui-menu-item w-full text-left',
                selectedTurnIndex === trace.turnIndex
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => setSelectedTurnIndex(trace.turnIndex)}
            >
              <span className="block text-xs font-medium">{t('trace.turnLabel', { index: trace.turnIndex })}</span>
              <span className="mt-0.5 block text-[10px] leading-snug opacity-80">
                {formatTurnSummary(trace, t, locale)}
              </span>
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {detail ? (
            <div className="flex shrink-0 items-center gap-1 border-b border-border px-3 py-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyTurn()}>
                {t('trace.copyTurn')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handleExportTurn}>
                {t('trace.exportTurn')}
              </Button>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {selectedTurnIndex === null ? (
              <p className="text-xs text-muted-foreground">{t('trace.selectTurn')}</p>
            ) : null}

            {isLoadingDetail && !detail ? (
              <p className="text-xs text-muted-foreground">{t('trace.loading')}</p>
            ) : null}

            {detail ? (
              <div className="flex flex-col gap-3">
                {detail.entries.map((entry, index) => (
                  <TraceEntrySection key={`${entry.type}-${entry.timestamp}-${index}`} entry={entry} />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
