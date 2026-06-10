import { ChevronDown, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/utils/cn'

interface ToolMessageProps {
  toolName?: string
  content: string
}

export function ToolMessage({ toolName, content }: ToolMessageProps) {
  const { t } = useTranslation('chat')
  const [open, setOpen] = useState(false)

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-background">
      <button
        type="button"
        className="ui-menu-item w-full text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Wrench className="size-3.5 shrink-0" strokeWidth={2} />
        <span className="truncate">{t('tool.label', { name: toolName ?? 'tool' })}</span>
        <ChevronDown
          className={cn('ml-auto size-3.5 shrink-0 transition-transform', open && 'rotate-180')}
          strokeWidth={2}
        />
      </button>
      {open ? (
        <pre className="max-h-48 overflow-auto border-t border-border px-3 py-2 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
          {content}
        </pre>
      ) : null}
    </div>
  )
}
