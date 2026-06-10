import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useTranslation } from '@/hooks/use-translation'
import { fetchModelsConfig, updateModelsConfig } from '@/services/settings-api'
import type { ModelsConfigResponse } from '@muse-ai/shared'

export function ModelsSettingsPage() {
  const { t } = useTranslation('settings')
  const [config, setConfig] = useState<ModelsConfigResponse | null>(null)
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const next = await fetchModelsConfig()
      setConfig(next)
      const initialProvider =
        next.defaultProvider && next.options.some((item) => item.id === next.defaultProvider)
          ? next.defaultProvider
          : (next.options[0]?.id ?? '')
      setProviderId(initialProvider)

      const providerOption = next.options.find((item) => item.id === initialProvider)
      const initialModel =
        next.defaultModel && providerOption?.models.some((item) => item.id === next.defaultModel)
          ? next.defaultModel
          : (providerOption?.models[0]?.id ?? '')
      setModelId(initialModel)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  const selectedProvider = useMemo(
    () => config?.options.find((item) => item.id === providerId),
    [config, providerId],
  )

  const handleProviderChange = (nextProviderId: string) => {
    setProviderId(nextProviderId)
    setSaved(false)
    const nextProvider = config?.options.find((item) => item.id === nextProviderId)
    setModelId(nextProvider?.models[0]?.id ?? '')
  }

  const handleSave = async () => {
    if (!providerId || !modelId) {
      return
    }

    setSaving(true)
    setSaved(false)
    try {
      await updateModelsConfig({ defaultProvider: providerId, defaultModel: modelId })
      setSaved(true)
      await loadConfig()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">{t('nav.models')}</h1>
        <p className="text-sm text-muted-foreground">{t('models.description')}</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t('models.loading')}</p>
      ) : config?.options.length === 0 ? (
        <div className="rounded-lg border border-border p-4 text-sm">
          <p className="text-muted-foreground">{t('models.noProviders')}</p>
          <Link to="/settings/providers" className="mt-2 inline-block text-primary hover:underline">
            {t('models.goToProviders')}
          </Link>
        </div>
      ) : (
        <div className="flex max-w-lg flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t('models.provider')}</span>
            <Select
              value={providerId}
              options={(config?.options ?? []).map((option) => ({
                value: option.id,
                label: option.name,
              }))}
              onValueChange={handleProviderChange}
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t('models.model')}</span>
            <Select
              value={modelId}
              options={(selectedProvider?.models ?? []).map((model) => ({
                value: model.id,
                label: model.name,
              }))}
              disabled={!selectedProvider?.models.length}
              onValueChange={(nextModelId) => {
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
      )}

    </div>
  )
}
