import { useTranslation } from 'react-i18next'
import { SUPPORTED_LOCALES, type SupportedLocale } from '@muse-ai/shared'
import { setAppLocale } from '@/i18n/setup'
import { Button } from '@/components/ui/button'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('common')
  const current = i18n.language.startsWith('zh') ? 'zh' : 'en'

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{t('language')}</span>
      {SUPPORTED_LOCALES.map(locale => (
        <Button
          key={locale}
          type="button"
          size="sm"
          variant={current === locale ? 'default' : 'outline'}
          onClick={() => setAppLocale(locale as SupportedLocale)}
        >
          {locale === 'zh' ? t('languageZh') : t('languageEn')}
        </Button>
      ))}
    </div>
  )
}
