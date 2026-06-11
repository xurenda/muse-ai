import JsonView from '@uiw/react-json-view'
import type { CSSProperties } from 'react'
import { useIsDark } from '@/hooks/use-is-dark'
import { cn } from '@/utils/cn'

interface JsonTreeViewProps {
  value: unknown
  /** 默认展开层级，更深节点初始折叠 */
  collapsed?: number | boolean
  className?: string
}

function buildJsonViewTheme(isDark: boolean): CSSProperties {
  return {
    '--w-rjv-font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    '--w-rjv-background-color': 'transparent',
    '--w-rjv-color': 'var(--foreground)',
    '--w-rjv-key-string': 'var(--foreground)',
    '--w-rjv-line-color': 'var(--border)',
    '--w-rjv-arrow-color': 'var(--muted-foreground)',
    '--w-rjv-info-color': 'var(--muted-foreground)',
    '--w-rjv-curlybraces-color': 'var(--muted-foreground)',
    '--w-rjv-colon-color': 'var(--muted-foreground)',
    '--w-rjv-brackets-color': 'var(--muted-foreground)',
    '--w-rjv-copied-color': 'var(--muted-foreground)',
    '--w-rjv-copied-success-color': 'var(--primary)',
    '--w-rjv-type-string-color': isDark ? 'oklch(0.78 0.08 75)' : 'oklch(0.45 0.12 75)',
    '--w-rjv-type-int-color': 'var(--primary)',
    '--w-rjv-type-float-color': 'var(--primary)',
    '--w-rjv-type-boolean-color': isDark ? 'oklch(0.72 0.12 252)' : 'oklch(0.48 0.17 252)',
    '--w-rjv-type-null-color': 'var(--muted-foreground)',
    '--w-rjv-type-undefined-color': 'var(--muted-foreground)',
  } as CSSProperties
}

export function JsonTreeView({ value, collapsed = 2, className }: JsonTreeViewProps) {
  const isDark = useIsDark()

  return (
    <div className={cn('p-3 text-xs leading-relaxed', className)}>
      <JsonView
        value={value as object}
        collapsed={collapsed}
        displayObjectSize={false}
        displayDataTypes={false}
        shortenTextAfterLength={120}
        style={buildJsonViewTheme(isDark)}
      />
    </div>
  )
}
