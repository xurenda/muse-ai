import { CodeBlock } from '@/components/chat/code-block'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/utils/cn'

interface ToolDetailPanelProps {
  input: string
  output: string
  isRunning: boolean
}

function detectInputLanguage(input: string): string {
  try {
    JSON.parse(input)
    return 'json'
  } catch {
    return 'text'
  }
}

const nestedCodeBlockClassName = 'rounded-none border-0 shadow-none'

export function ToolDetailPanel({ input, output, isRunning }: ToolDetailPanelProps) {
  const { t } = useTranslation('chat')
  const hasInput = input.trim().length > 0
  const hasOutput = output.trim().length > 0
  const showOutputSection = hasOutput || isRunning

  if (!hasInput && !showOutputSection) {
    return null
  }

  return (
    <div className="mt-1.5 overflow-hidden rounded-md border border-border bg-muted/40">
      {hasInput ? (
        <div className="max-h-24 overflow-auto bg-background">
          <CodeBlock code={input} language={detectInputLanguage(input)} className={nestedCodeBlockClassName} />
        </div>
      ) : null}

      {showOutputSection ? (
        <div className={cn('max-h-48 overflow-auto bg-background', hasInput && 'border-t border-border')}>
          {hasOutput ? (
            <CodeBlock code={output} language="text" className={nestedCodeBlockClassName} />
          ) : (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              <span className="process-shimmer">{t('explore.running')}</span>
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
