import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { ModelStrategyConfig, ModelStrategyPools, ModelStrategyResponse, ModelStrategyTaskRouting } from '@muse-ai/shared'
import { fetchModelStrategy, updateModelStrategy } from '@/api/settings-api'
import { BackendApiError } from '@/api/backend-client'
import { ModelStrategyForm } from '@/components/settings/model-strategy-form'
import { PageShell } from '@/components/layout/page-shell'
import { useAuth } from '@/hooks/use-auth'
import { cloneModelStrategy } from '@/utils/model-strategy-ui'

/** 模型组拖拽/增删：停止操作后再保存，避免频繁请求 */
const POOLS_SAVE_DEBOUNCE_MS = 600

export function ModelsSettingsPage() {
  const { t } = useTranslation('settings')
  const { auth } = useAuth()
  const [response, setResponse] = useState<ModelStrategyResponse | null>(null)
  const [draft, setDraft] = useState<ModelStrategyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const draftRef = useRef<ModelStrategyConfig | null>(null)
  const poolsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingPoolsSaveRef = useRef<ModelStrategyConfig | null>(null)

  const applyResponse = useCallback((next: ModelStrategyResponse) => {
    setResponse(next)
    const cloned = cloneModelStrategy(next.strategy)
    setDraft(cloned)
    draftRef.current = cloned
  }, [])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const persistStrategy = useCallback(
    async (next: ModelStrategyConfig) => {
      if (!auth) return

      try {
        await updateModelStrategy(auth.accessToken, next)
      } catch (error: unknown) {
        if (error instanceof BackendApiError) {
          toast.error(error.message || t('providers.failed'))
        } else {
          toast.error(error instanceof Error ? error.message : t('providers.failed'))
        }
      }
    },
    [auth, t],
  )

  const cancelPendingPoolsSave = useCallback(() => {
    if (poolsSaveTimerRef.current) {
      clearTimeout(poolsSaveTimerRef.current)
      poolsSaveTimerRef.current = undefined
    }
    pendingPoolsSaveRef.current = null
  }, [])

  const schedulePoolsSave = useCallback(
    (next: ModelStrategyConfig) => {
      pendingPoolsSaveRef.current = next
      if (poolsSaveTimerRef.current) {
        clearTimeout(poolsSaveTimerRef.current)
      }
      poolsSaveTimerRef.current = setTimeout(() => {
        poolsSaveTimerRef.current = undefined
        const pending = pendingPoolsSaveRef.current
        pendingPoolsSaveRef.current = null
        if (pending) {
          void persistStrategy(pending)
        }
      }, POOLS_SAVE_DEBOUNCE_MS)
    },
    [persistStrategy],
  )

  const handlePoolsChange = useCallback(
    (pools: ModelStrategyPools) => {
      setDraft(current => {
        if (!current) return current
        const next = { ...current, pools }
        schedulePoolsSave(next)
        return next
      })
    },
    [schedulePoolsSave],
  )

  const handleTaskRoutingChange = useCallback(
    (taskRouting: ModelStrategyTaskRouting) => {
      // 仅取消 debounce，避免旧 pools 定时保存覆盖刚改的 taskRouting；无需先保存 pools
      cancelPendingPoolsSave()
      setDraft(current => {
        if (!current) return current
        const next = { ...current, taskRouting }
        void persistStrategy(next)
        return next
      })
    },
    [cancelPendingPoolsSave, persistStrategy],
  )

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

  useEffect(() => {
    return () => {
      if (poolsSaveTimerRef.current) {
        clearTimeout(poolsSaveTimerRef.current)
        const latest = draftRef.current
        if (latest && auth) {
          void updateModelStrategy(auth.accessToken, latest).catch(() => {
            // 离开页面时静默失败，避免 unmount 后 toast
          })
        }
      }
      pendingPoolsSaveRef.current = null
    }
  }, [auth])

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
        <ModelStrategyForm strategy={draft} options={response.options} onPoolsChange={handlePoolsChange} onTaskRoutingChange={handleTaskRoutingChange} />
      ) : null}
    </PageShell>
  )
}
