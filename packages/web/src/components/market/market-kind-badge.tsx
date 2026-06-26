import { useTranslation } from 'react-i18next'
import type { MarketPackageKind } from '@museai/shared'
import { cn } from '@/lib/utils'

interface MarketKindBadgeProps {
  kind: MarketPackageKind
  className?: string
}

export function MarketKindBadge({ kind, className }: MarketKindBadgeProps) {
  const { t } = useTranslation('market')

  return (
    <span className={cn('inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground', className)}>
      {t(`kind.${kind}`)}
    </span>
  )
}
