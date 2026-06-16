import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { ModelsConfigResponse } from '@muse-ai/shared'
import { fetchModelsConfig, updateModelsConfig } from '@/api/settings-api'
import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useAuth } from '@/hooks/use-auth'

export function ModelsSettingsPage() {
  const { t } = useTranslation('settings')
  const { auth } = useAuth()
  const [config, setConfig] = useState<ModelsConfigResponse | null>(null)
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const applyConfig = useCallback((next: ModelsConfigResponse) => {
    setConfig(next)

    const initialProvider =
      next.defaultProvider && next.options.some(item => item.id === next.defaultProvider) ? next.defaultProvider : (next.options[0]?.id ?? '')

    setProviderId(initialProvider)
    const providerOption = next.options.find(item => item.id === initialProvider)
    const initialModel =
      next.defaultModel && providerOption?.models.some(item => item.id === next.defaultModel) ? next.defaultModel : (providerOption?.models[0]?.id ?? '')
    setModelId(initialModel)
  }, [])

  useEffect(() => {
    if (!auth) return

    let cancelled = false
    void (async () => {
      try {
        const next = await fetchModelsConfig(auth.accessToken)
        if (!cancelled) {
          applyConfig(next)
        }
      } catch (error: unknown) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t('providers.failed'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applyConfig, auth, t])

  const refreshConfig = useCallback(async () => {
    if (!auth) return

    try {
      const next = await fetchModelsConfig(auth.accessToken)
      applyConfig(next)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('providers.failed'))
    }
  }, [applyConfig, auth, t])

  const selectedProvider = useMemo(() => config?.options.find(item => item.id === providerId), [config, providerId])

  const handleProviderChange = (nextProviderId: string) => {
    setProviderId(nextProviderId)
    setSaved(false)
    const nextProvider = config?.options.find(item => item.id === nextProviderId)
    setModelId(nextProvider?.models[0]?.id ?? '')
  }

  const handleSave = async () => {
    if (!auth || !providerId || !modelId) return

    setSaving(true)
    setSaved(false)
    try {
      await updateModelsConfig(auth.accessToken, { defaultProvider: providerId, defaultModel: modelId })
      setSaved(true)
      await refreshConfig()
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t('providers.failed'))
    } finally {
      setSaving(false)
    }
  }

  if (!auth) return null

  return (
    <PageShell title={t('nav.models')} subtitle={t('models.description')}>
      {loading ? <p className="px-1 text-sm text-muted-foreground">{t('models.loading')}</p> : null}

      {!loading && config?.options.length === 0 ? (
        <div className="rounded-lg border border-border px-4 py-3.5 text-sm">
          <p className="text-muted-foreground">{t('models.noProviders')}</p>
          <Link to="/settings/providers" className="mt-2 inline-block text-primary hover:underline">
            {t('models.goToProviders')}
          </Link>
        </div>
      ) : null}

      {!loading && config && config.options.length > 0 ? (
        <div className="flex max-w-lg flex-col gap-4 px-1">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t('models.provider')}</span>
            <Select
              value={providerId}
              options={config.options.map(option => ({ value: option.id, label: option.name }))}
              onValueChange={handleProviderChange}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t('models.model')}</span>
            <Select
              value={modelId}
              options={(selectedProvider?.models ?? []).map(model => ({ value: model.id, label: model.name }))}
              disabled={!selectedProvider?.models.length}
              onValueChange={nextModelId => {
                setModelId(nextModelId)
                setSaved(false)
              }}
            />
          </label>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={() => void handleSave()} disabled={saving || !providerId || !modelId}>
              {saving ? t('models.saving') : t('models.save')}
            </Button>
            {saved ? <span className="text-sm text-muted-foreground">{t('models.saved')}</span> : null}
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
