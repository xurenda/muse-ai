import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BASIC_KIT_PACKAGE_ID, compareSemver, type AgentDefinition, type MarketPackageDetail } from '@museai/shared'
import { getMarketPackageDetail } from '@/api/backend-client'
import { CliApiError, installMarketPackage, listInstalledMarketPackages, uninstallMarketPackage, updateMarketPackage } from '@/api/cli-client'
import { MarketKindBadge } from '@/components/market/market-kind-badge'
import { MarketNoDeviceHint } from '@/components/market/market-no-device-hint'
import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { parseMarketPackageIdFromSplat } from '@/lib/market-package-path'

export function MarketDetailPage() {
  const { t } = useTranslation('market')
  const { t: tc } = useTranslation('common')
  const navigate = useNavigate()
  const splat = useParams()['*']
  const packageId = parseMarketPackageIdFromSplat(splat)
  const { deviceSession, getValidAccessToken } = useAuth()

  const [detail, setDetail] = useState<MarketPackageDetail | null>(null)
  const [installedVersion, setInstalledVersion] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [conflictingAgents, setConflictingAgents] = useState<AgentDefinition[]>([])

  const fetchInstalledVersion = useCallback(async (): Promise<string | null> => {
    if (!deviceSession || !packageId) return null
    const installed = await listInstalledMarketPackages(deviceSession.endpoint, deviceSession.accessToken)
    return installed.packages[packageId]?.version ?? null
  }, [deviceSession, packageId])

  useEffect(() => {
    if (!packageId) {
      navigate('/market', { replace: true })
      return
    }

    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const token = await getValidAccessToken()
        setDetail(await getMarketPackageDetail(token, packageId))
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('loadFailed'))
      } finally {
        setLoading(false)
      }
    })()
  }, [getValidAccessToken, navigate, packageId, t])

  useEffect(() => {
    if (!deviceSession || !packageId) return
    let cancelled = false
    void (async () => {
      try {
        const version = await fetchInstalledVersion()
        if (!cancelled) setInstalledVersion(version)
      } catch {
        if (!cancelled) setInstalledVersion(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [deviceSession, packageId, fetchInstalledVersion])

  const effectiveInstalledVersion = deviceSession ? installedVersion : null
  const updateAvailable = Boolean(effectiveInstalledVersion && detail && compareSemver(detail.latestVersion, effectiveInstalledVersion) > 0)
  const isInstalled = Boolean(effectiveInstalledVersion)
  const canUninstall = isInstalled && packageId !== BASIC_KIT_PACKAGE_ID

  async function runAction(action: 'install' | 'update' | 'uninstall') {
    if (!deviceSession || !packageId) return
    setActionLoading(true)
    setActionError(null)
    setConflictingAgents([])
    try {
      if (action === 'install') {
        await installMarketPackage(deviceSession.endpoint, deviceSession.accessToken, { packageId })
      } else if (action === 'update') {
        await updateMarketPackage(deviceSession.endpoint, deviceSession.accessToken, { packageId })
      } else {
        await uninstallMarketPackage(deviceSession.endpoint, deviceSession.accessToken, { packageId })
      }
      setInstalledVersion(await fetchInstalledVersion())
    } catch (err: unknown) {
      if (err instanceof CliApiError) {
        setActionError(err.message)
        if (err.code === 'agents_reference_conflict') {
          const body = err.details as { conflictingAgents?: AgentDefinition[] } | undefined
          setConflictingAgents(body?.conflictingAgents ?? [])
        }
      } else {
        setActionError(err instanceof Error ? err.message : t('actionFailed'))
      }
    } finally {
      setActionLoading(false)
    }
  }

  if (!packageId) return null

  return (
    <PageShell title={detail?.name ?? packageId}>
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/market">{t('backToList')}</Link>
        </Button>
      </div>

      {loading ? <p className="px-1 text-sm text-muted-foreground">{tc('loading')}</p> : null}
      {error ? <p className="px-1 text-sm text-destructive">{error}</p> : null}

      {detail ? (
        <div className="flex flex-col gap-4 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <MarketKindBadge kind={detail.kind} />
            <span className="text-sm text-muted-foreground">{detail.author}</span>
          </div>

          {detail.description ? <p className="text-sm text-muted-foreground">{detail.description}</p> : null}

          <div className="rounded-lg border border-border bg-card/40 p-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t('packageId')}</dt>
                <dd className="font-mono text-xs">{detail.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('latestVersionLabel')}</dt>
                <dd>{detail.latestVersion}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('installedVersion')}</dt>
                <dd>{effectiveInstalledVersion ?? t('notInstalled')}</dd>
              </div>
            </dl>
          </div>

          {!deviceSession ? <MarketNoDeviceHint /> : null}

          {deviceSession ? (
            <div className="flex flex-wrap gap-2">
              {!isInstalled ? (
                <Button type="button" disabled={actionLoading} onClick={() => void runAction('install')}>
                  {actionLoading ? tc('loading') : t('install')}
                </Button>
              ) : null}
              {isInstalled && updateAvailable ? (
                <Button type="button" disabled={actionLoading} onClick={() => void runAction('update')}>
                  {actionLoading ? tc('loading') : t('update')}
                </Button>
              ) : null}
              {canUninstall ? (
                <Button type="button" variant="destructive" disabled={actionLoading} onClick={() => void runAction('uninstall')}>
                  {actionLoading ? tc('loading') : t('uninstall')}
                </Button>
              ) : null}
              {isInstalled && !updateAvailable ? <p className="self-center text-sm text-muted-foreground">{t('upToDate')}</p> : null}
            </div>
          ) : null}

          {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          {conflictingAgents.length > 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">{t('conflictTitle')}</p>
              <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                {conflictingAgents.map(agent => (
                  <li key={agent.id}>
                    {agent.name} ({agent.id})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  )
}
