import { useTranslation } from 'react-i18next'
import type { SessionTokenUsage } from '@muse-ai/shared'
import { formatTokenCount } from '@/lib/format-token-count'

interface SessionTokenUsageProps {
  usage: SessionTokenUsage | undefined
  /** 行内展示（面板详情行） */
  inline?: boolean
}

export function SessionTokenUsageDisplay({ usage, inline = false }: SessionTokenUsageProps) {
  const { t } = useTranslation('chat')

  if (!usage || usage.total <= 0) {
    if (inline) return <span className="text-muted-foreground">—</span>
    return null
  }

  const input = formatTokenCount(usage.input)
  const output = formatTokenCount(usage.output)
  const total = formatTokenCount(usage.total)

  const label =
    usage.costTotal !== undefined && usage.costTotal > 0
      ? t('sessionTokenUsageWithCost', {
          input,
          output,
          total,
          cost: usage.costTotal.toFixed(3),
        })
      : t('sessionTokenUsage', { input, output, total })

  if (inline) {
    return <span className="min-w-0 tabular-nums">{label}</span>
  }

  return (
    <p className="text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
      {label}
    </p>
  )
}
