import { useTranslation } from 'react-i18next'
import type { AssetSource } from '@museai/shared'
import { cn } from '@/lib/utils'

interface AssetSourceBadgeProps {
  source: AssetSource
  className?: string
}

export function AssetSourceBadge({ source, className }: AssetSourceBadgeProps) {
  const { t } = useTranslation('market')
  const isMarket = source === 'market'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none',
        isMarket ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        className,
      )}
    >
      {isMarket ? t('source.market') : t('source.local')}
    </span>
  )
}
