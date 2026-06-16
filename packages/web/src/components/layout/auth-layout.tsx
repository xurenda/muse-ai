import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@/components/language-switcher'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex justify-end p-4">
        <LanguageSwitcher />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-12">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold tracking-wide text-primary">{t('appName')}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-sm">{children}</div>
        {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
      </div>
    </div>
  )
}
