import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ProviderSummary } from '@muse-ai/shared'
import { createProvider, deleteProvider, listProviders, updateProvider } from '@/api/backend-client'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/use-auth'

export function ProvidersPage() {
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

  async function reload() {
    if (!auth) return
    setProviders(await listProviders(auth.accessToken))
  }

  useEffect(() => {
    if (!auth) return
    void listProviders(auth.accessToken).then(setProviders)
  }, [auth])

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
    <div className="mx-auto min-h-screen max-w-3xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <LanguageSwitcher />
          <Button variant="outline" size="sm" asChild>
            <Link to="/chat">{tc('back')}</Link>
          </Button>
        </div>
      </header>

      <form className="mb-8 space-y-4 rounded-lg border border-border bg-card p-6" onSubmit={onSubmit => void onAdd(onSubmit)}>
        <h2 className="text-lg font-medium">{t('add')}</h2>
        <div>
          <Label htmlFor="pname">{t('name')}</Label>
          <Input id="pname" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="baseUrl">{t('baseUrl')}</Label>
          <Input id="baseUrl" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="apiKey">{t('apiKey')}</Label>
          <Input id="apiKey" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} required />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} />
          {t('isDefault')}
        </label>
        <Button type="submit">{t('save')}</Button>
      </form>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-success">{message}</p> : null}

      <section className="space-y-3">
        {providers.length === 0 ? (
          <p className="text-muted-foreground">{t('empty')}</p>
        ) : (
          providers.map(provider => (
            <div key={provider.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
              <div>
                <p className="font-medium">
                  {provider.name}
                  {provider.isDefault ? <span className="ml-2 rounded bg-primary/20 px-2 py-0.5 text-xs text-primary">{t('defaultBadge')}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">{provider.baseUrl}</p>
              </div>
              <div className="flex gap-2">
                {!provider.isDefault ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void onSetDefault(provider)}>
                    {t('isDefault')}
                  </Button>
                ) : null}
                <Button type="button" size="sm" variant="destructive" onClick={() => void onDelete(provider.id)}>
                  {t('delete')}
                </Button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
