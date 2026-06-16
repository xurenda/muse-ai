import { useEffect, useState } from 'react'
import { useIsDark } from '@/hooks/use-is-dark'
import { cn } from '@/lib/utils'
import { highlightCode } from '@/utils/shiki-highlighter'

interface CodeBlockProps {
  code: string
  language: string
  className?: string
}

export function CodeBlock({ code, language, className }: CodeBlockProps) {
  const isDark = useIsDark()
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void highlightCode(code, language, isDark).then(result => {
      if (!cancelled) {
        setHtml(result)
      }
    })

    return () => {
      cancelled = true
    }
  }, [code, isDark, language])

  if (!html) {
    return (
      <pre className={cn('not-prose overflow-x-auto rounded-md border border-border bg-background p-3 text-xs leading-relaxed', className)}>
        <code className="block font-mono whitespace-pre">{code}</code>
      </pre>
    )
  }

  return (
    <div
      className={cn(
        'not-prose overflow-x-auto rounded-md border border-border bg-background text-xs leading-relaxed',
        '[&_.shiki]:overflow-x-auto [&_.shiki]:bg-transparent! [&_.shiki]:p-3 [&_.shiki]:font-mono [&_.shiki]:whitespace-pre',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
