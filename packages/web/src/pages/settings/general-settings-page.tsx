import { useTranslation } from 'react-i18next'
import { PageShell } from '@/components/layout/page-shell'

export function GeneralSettingsPage() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')

  return (
    <PageShell title={t('nav.general')}>
      <p className="px-1 text-sm text-muted-foreground">{tc('underDevelopment')}</p>
    </PageShell>
  )
}
