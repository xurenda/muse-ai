import { FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProviderSummary } from '@muse-ai/shared'
import { createProvider, deleteProvider, listProviders, updateProvider } from '@/api/backend-client'
import { PageShell } from '@/components/layout/page-shell'
import { SettingsFieldRow } from '@/components/settings/settings-field-row'
import { SettingsRow } from '@/components/settings/settings-row'
import { SettingsSection } from '@/components/settings/settings-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'

export function ProvidersSettingsPage() {
  const { t } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const { auth } = useAuth()
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1')
  const [apiKey, setApiKey] = useState('')
  const [isDefault, setIsDefault] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function reload() {
    if (!auth) return
    setProviders(await listProviders(auth.accessToken))
  }

  const accessToken = auth?.accessToken

  useEffect(() => {
    if (!accessToken) {
      queueMicrotask(() => {
        setProviders([])
        setLoading(false)
      })
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setLoading(true)
    })

    void listProviders(accessToken)
      .then(setProviders)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken])

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    if (!auth) return
    setError(null)
    setMessage(null)
    try {
      await createProvider(auth.accessToken, { name, apiKey, baseUrl, isDefault })
      setMessage(t('added'))
      setName('')
      setApiKey('')
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failed'))
    }
  }

  async function onSetDefault(provider: ProviderSummary) {
    if (!auth || provider.isDefault) return
    setError(null)
    setMessage(null)
    try {
      await updateProvider(auth.accessToken, provider.id, { isDefault: true })
      setMessage(t('updated'))
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failed'))
    }
  }

  async function onDelete(providerId: string) {
    if (!auth) return
    setError(null)
    setMessage(null)
    try {
      await deleteProvider(auth.accessToken, providerId)
      setMessage(t('deleted'))
      await reload()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('failed'))
    }
  }

  if (!auth) return null

  return (
    <PageShell title={t('nav.providers')} subtitle={t('subtitle')}>
      {error ? <p className="px-1 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="px-1 text-sm text-success">{message}</p> : null}

      <SettingsSection title={t('add')}>
        <form className="flex flex-col gap-4 px-4 py-3.5" onSubmit={onSubmit => void onAdd(onSubmit)}>
          <SettingsFieldRow label={t('name')}>
            <Input value={name} onChange={e => setName(e.target.value)} required />
          </SettingsFieldRow>
          <SettingsFieldRow label={t('baseUrl')}>
            <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} required />
          </SettingsFieldRow>
          <SettingsFieldRow label={t('apiKey')}>
            <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} required />
          </SettingsFieldRow>
          <SettingsFieldRow label={t('isDefault')}>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
              {t('isDefault')}
            </label>
          </SettingsFieldRow>
          <div className="flex justify-end pt-1">
            <Button type="submit">{t('save')}</Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection title={t('listTitle')}>
        {loading ? <p className="px-4 py-3.5 text-sm text-muted-foreground">{tc('loading')}</p> : null}
        {!loading && providers.length === 0 ? <p className="px-4 py-3.5 text-sm text-muted-foreground">{t('empty')}</p> : null}
        {!loading
          ? providers.map(provider => (
              <SettingsRow key={provider.id} title={provider.name} description={provider.baseUrl}>
                {provider.isDefault ? <span className="rounded bg-primary/15 px-2 py-0.5 text-xs text-primary">{t('defaultBadge')}</span> : null}
                {!provider.isDefault ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void onSetDefault(provider)}>
                    {t('isDefault')}
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="destructive" onClick={() => void onDelete(provider.id)}>
                  {t('delete')}
                </Button>
              </SettingsRow>
            ))
          : null}
      </SettingsSection>
    </PageShell>
  )
}
