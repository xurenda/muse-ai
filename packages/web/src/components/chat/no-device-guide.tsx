import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function NoDeviceGuide() {
  const { t } = useTranslation('chat')
  const { t: td } = useTranslation('device')

  const steps = [
    { title: t('noDevice.step1Title'), body: t('noDevice.step1Body'), action: { label: td('pairGenerate'), to: '/devices' } },
    { title: t('noDevice.step2Title'), body: t('noDevice.step2Body'), code: t('noDevice.step2Command') },
    { title: t('noDevice.step3Title'), body: t('noDevice.step3Body'), action: { label: t('noDevice.selectDevice'), to: '/devices' } },
  ]

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{t('noDevice.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('noDevice.subtitle')}</p>
        </div>

        <ol className="space-y-4 text-left">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-lg border border-border bg-card/50 p-4">
              <p className="text-sm font-medium text-foreground">
                {index + 1}. {step.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              {'code' in step && step.code ? (
                <code className="mt-3 block rounded bg-muted px-3 py-2 font-mono text-xs text-foreground">{step.code}</code>
              ) : null}
              {'action' in step && step.action ? (
                <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
                  <Link to={step.action.to}>{step.action.label}</Link>
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
