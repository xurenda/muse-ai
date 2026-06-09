import { useTranslation } from '@/hooks/use-translation'

export function ModelsSettingsPage() {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-lg font-semibold">{t('nav.models')}</h1>
      <p className="text-sm text-muted-foreground">{tCommon('underDevelopment')}</p>
    </div>
  )
}
