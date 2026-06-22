import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { ModelStrategyConfig, ModelStrategyResponse } from '@muse-ai/shared'
import { fetchModelStrategy, updateModelStrategy } from '@/api/settings-api'
import { BackendApiError } from '@/api/backend-client'
import { ModelStrategyForm } from '@/components/settings/model-strategy-form'
import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { cloneModelStrategy } from '@/utils/model-strategy-ui'

export function ModelsSettingsPage() {
  const { t } = useTranslation('settings')
  const { auth } = useAuth()
  const [response, setResponse] = useState<ModelStrategyResponse | null>(null)
  const [draft, setDraft] = useState<ModelStrategyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const applyResponse = useCallback((next: ModelStrategyResponse) => {
    setResponse(next)
    setDraft(cloneModelStrategy(next.strategy))
  }, [])

  useEffect(() => {
    if (!auth) return

    let cancelled = false
    void (async () => {
      try {
        const next = await fetchModelStrategy(auth.accessToken)
        if (!cancelled) {
          applyResponse(next)
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
  }, [applyResponse, auth, t])

  const handleSave = async () => {
    if (!auth || !draft) return

    setSaving(true)
    setSaved(false)
    try {
      await updateModelStrategy(auth.accessToken, draft)
      setSaved(true)
      const next = await fetchModelStrategy(auth.accessToken)
      applyResponse(next)
    } catch (error: unknown) {
      if (error instanceof BackendApiError) {
        toast.error(error.message || t('providers.failed'))
      } else {
        toast.error(error instanceof Error ? error.message : t('providers.failed'))
      }
    } finally {
      setSaving(false)
    }
  }

  if (!auth) return null

  return (
    <PageShell title={t('nav.models')} subtitle={t('models.description')}>
      {loading ? <p className="px-1 text-sm text-muted-foreground">{t('models.loading')}</p> : null}

      {!loading && response?.options.length === 0 ? (
        <div className="rounded-lg border border-border px-4 py-3.5 text-sm">
          <p className="text-muted-foreground">{t('models.noProviders')}</p>
          <Link to="/settings/providers" className="mt-2 inline-block text-primary hover:underline">
            {t('models.goToProviders')}
          </Link>
        </div>
      ) : null}

      {!loading && response && draft && response.options.length > 0 ? (
        <div className="flex flex-col gap-4">
          <ModelStrategyForm
            strategy={draft}
            options={response.options}
            onChange={next => {
              setDraft(next)
              setSaved(false)
            }}
          />

          <div className="flex items-center gap-3 px-1">
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? t('models.saving') : t('models.save')}
            </Button>
            {saved ? <span className="text-sm text-muted-foreground">{t('models.saved')}</span> : null}
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
