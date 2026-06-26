import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function MarketNoDeviceHint() {
  const { t } = useTranslation('market')
  const { t: tl } = useTranslation('layout')

  return (
    <div className="rounded-lg border border-border bg-card/50 px-4 py-3 text-sm">
      <p className="text-muted-foreground">{t('noDeviceHint')}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
        <Link to="/devices">{tl('sidebar.devices')}</Link>
      </Button>
    </div>
  )
}
