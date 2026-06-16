import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

interface ThinkingBlockProps {
  content: string
  streaming?: boolean
}

export function ThinkingBlock({ content, streaming }: ThinkingBlockProps) {
  const { t } = useTranslation('chat')
  const [open, setOpen] = useState(false)

  if (!content && !streaming) return null

  return (
    <div className="mb-3 rounded-md border border-border/60 bg-background/60">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(prev => !prev)}
      >
        <span>{streaming ? t('thinkingStreaming') : t('thinkingTitle')}</span>
        <span>{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-t border-border/60 px-3 py-2 font-mono text-xs text-muted-foreground">
          {content || t('thinkingEmpty')}
        </pre>
      ) : null}
    </div>
  )
}

interface ToolCallCardProps {
  toolName: string
  args: unknown
  result?: unknown
  isError?: boolean
  status: 'running' | 'done'
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function ToolCallCard({ toolName, args, result, isError, status }: ToolCallCardProps) {
  const { t } = useTranslation('chat')

  return (
    <div className="mb-3 rounded-md border border-border bg-background/80">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="font-mono text-xs text-primary">{toolName}</span>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
            status === 'running' ? 'bg-primary/20 text-primary' : isError ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success',
          )}
        >
          {status === 'running' ? t('toolRunning') : isError ? t('toolError') : t('toolDone')}
        </span>
      </div>
      <details className="group border-b border-border/40 px-3 py-2" open>
        <summary className="cursor-pointer text-xs text-muted-foreground">{t('toolArgs')}</summary>
        <pre className="mt-2 overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground/90">{formatJson(args)}</pre>
      </details>
      {status === 'done' ? (
        <details className="px-3 py-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">{t('toolResult')}</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground/90">{formatJson(result)}</pre>
        </details>
      ) : null}
    </div>
  )
}
