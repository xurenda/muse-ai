import { useTranslation } from '@/hooks/use-translation'

export function PlanningIndicator() {
  const { t } = useTranslation('chat')

  return (
    <p className="text-sm text-muted-foreground">
      <span className="process-shimmer">{t('planning.label')}</span>
    </p>
  )
}
