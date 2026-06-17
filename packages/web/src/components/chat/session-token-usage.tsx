import { useTranslation } from 'react-i18next'
import type { SessionTokenUsage } from '@muse-ai/shared'
import { formatTokenCount } from '@/lib/format-token-count'

interface SessionTokenUsageProps {
  usage: SessionTokenUsage | undefined
}

export function SessionTokenUsageDisplay({ usage }: SessionTokenUsageProps) {
  const { t } = useTranslation('chat')

  if (!usage || usage.total <= 0) return null

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

  return (
    <p className="text-[11px] tabular-nums text-muted-foreground" aria-live="polite">
      {label}
    </p>
  )
}
