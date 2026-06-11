import { CodeBlock } from '@/components/chat/code-block'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/use-translation'
import type { LlmTraceEntry } from '@muse-ai/shared'
import {
  formatTraceEntryContent,
  formatTraceTimestamp,
  getTraceTypeAccentClass,
  isTraceEntryCollapsedByDefault,
  serializeTraceEntry,
} from '@/utils/trace-format'
import { cn } from '@/utils/cn'
import { toast } from 'sonner'

interface TraceEntrySectionProps {
  entry: LlmTraceEntry
}

function resolveTraceTypeLabel(type: string, t: (key: string) => string): string {
  const label = t(`trace.type.${type}`)
  return label === `trace.type.${type}` ? type : label
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text)
}

export function TraceEntrySection({ entry }: TraceEntrySectionProps) {
  const { t, locale } = useTranslation('chat')
  const typeLabel = resolveTraceTypeLabel(entry.type, t)
  const collapsedByDefault = isTraceEntryCollapsedByDefault(entry.type)

  const handleCopy = async () => {
    try {
      await copyText(serializeTraceEntry(entry))
      toast.success(t('trace.copied'))
    } catch {
      toast.error(t('trace.copyFailed'))
    }
  }

  return (
    <details
      open={!collapsedByDefault}
      className={cn('group rounded-md border border-border border-l-2 bg-muted/20', getTraceTypeAccentClass(entry.type))}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 px-3 py-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs font-medium text-foreground">{typeLabel}</span>
            <span className="text-[11px] text-muted-foreground">{formatTraceTimestamp(entry.timestamp, locale)}</span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 shrink-0 px-2 text-[11px]"
          onClick={(event) => {
            event.preventDefault()
            void handleCopy()
          }}
        >
          {t('trace.copyEntry')}
        </Button>
      </summary>

      <div className="border-t border-border px-3 pb-3 pt-2">
        <div className="max-h-80 overflow-auto rounded-md border border-border bg-background/80">
          <CodeBlock code={formatTraceEntryContent(entry)} language="json" className="rounded-none border-0" />
        </div>
      </div>
    </details>
  )
}
