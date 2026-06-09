import { useTranslation } from '@/hooks/use-translation'

interface PlaceholderPageProps {
  titleKey: string
}

export function PlaceholderPage({ titleKey }: PlaceholderPageProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">
          {t(titleKey)}: {t('underDevelopment')}
        </p>
      </div>
    </div>
  )
}
