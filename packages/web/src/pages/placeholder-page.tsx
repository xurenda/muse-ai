import { useTranslation } from '@/hooks/use-translation'

interface PlaceholderPageProps {
  titleKey: string
}

export function PlaceholderPage({ titleKey }: PlaceholderPageProps) {
  const { t } = useTranslation('common')

  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b border-border/60 px-5">
        <h1 className="text-sm font-medium">{t(titleKey)}</h1>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">{t('underDevelopment')}</p>
      </div>
    </>
  )
}
