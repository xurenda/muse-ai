import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { compareSemver, type MarketPackageSummary } from '@museai/shared'
import { listMarketPackages } from '@/api/backend-client'
import { listInstalledMarketPackages, updateMarketPackage, CliApiError } from '@/api/cli-client'
import { MarketKindBadge } from '@/components/market/market-kind-badge'
import { PageShell } from '@/components/layout/page-shell'
import { SettingsRow } from '@/components/settings/settings-row'
import { SettingsSection } from '@/components/settings/settings-section'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { marketPackagePath } from '@/lib/market-package-path'

interface InstalledRow {
  packageId: string
  installedVersion: string
  summary?: MarketPackageSummary
  updateAvailable: boolean
}

export function MarketInstalledPage() {
  const { t } = useTranslation('market')
  const { t: tc } = useTranslation('common')
  const { deviceSession, getValidAccessToken } = useAuth()
  const [rows, setRows] = useState<InstalledRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    if (!deviceSession) return

    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const token = await getValidAccessToken()
        const [installed, catalog] = await Promise.all([
          listInstalledMarketPackages(deviceSession.endpoint, deviceSession.accessToken),
          listMarketPackages(token),
        ])
        const summaryById = new Map(catalog.packages.map(pkg => [pkg.id, pkg]))
        const nextRows: InstalledRow[] = Object.entries(installed.packages).map(([packageId, entry]) => {
          const summary = summaryById.get(packageId)
          const updateAvailable = summary ? compareSemver(summary.latestVersion, entry.version) > 0 : false
          return {
            packageId,
            installedVersion: entry.version,
            summary,
            updateAvailable,
          }
        })
        nextRows.sort((a, b) => a.packageId.localeCompare(b.packageId, 'zh-CN'))
        setRows(nextRows)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('loadFailed'))
      } finally {
        setLoading(false)
      }
    })()
  }, [deviceSession, getValidAccessToken, t])

  async function onUpdate(packageId: string) {
    if (!deviceSession) return
    setUpdatingId(packageId)
    setError(null)
    try {
      await updateMarketPackage(deviceSession.endpoint, deviceSession.accessToken, { packageId })
      const token = await getValidAccessToken()
      const [installed, catalog] = await Promise.all([
        listInstalledMarketPackages(deviceSession.endpoint, deviceSession.accessToken),
        listMarketPackages(token),
      ])
      const summary = catalog.packages.find(pkg => pkg.id === packageId)
      const entry = installed.packages[packageId]
      if (entry) {
        setRows(prev =>
          prev.map(row =>
            row.packageId === packageId
              ? {
                  ...row,
                  installedVersion: entry.version,
                  summary,
                  updateAvailable: summary ? compareSemver(summary.latestVersion, entry.version) > 0 : false,
                }
              : row,
          ),
        )
      }
    } catch (err: unknown) {
      setError(err instanceof CliApiError ? err.message : err instanceof Error ? err.message : t('actionFailed'))
    } finally {
      setUpdatingId(null)
    }
  }

  if (!deviceSession) {
    return (
      <PageShell title={t('installedTitle')}>
        <div className="flex flex-col items-center gap-3 px-1 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t('installedNoDevice')}</p>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link to="/devices">{t('goDevices')}</Link>
          </Button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title={t('installedTitle')} subtitle={t('installedSubtitle')}>
      <div className="flex items-center justify-end gap-2 px-1">
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to="/market">{t('backToList')}</Link>
        </Button>
      </div>

      {loading ? <p className="px-1 text-sm text-muted-foreground">{tc('loading')}</p> : null}
      {error ? <p className="px-1 text-sm text-destructive">{error}</p> : null}

      <SettingsSection title={t('installedSection')}>
        {rows.length === 0 && !loading ? <p className="px-4 py-3.5 text-sm text-muted-foreground">{t('installedEmpty')}</p> : null}
        {rows.map(row => (
          <SettingsRow
            key={row.packageId}
            title={row.summary?.name ?? row.packageId}
            description={t('installedRowVersion', {
              installed: row.installedVersion,
              latest: row.summary?.latestVersion ?? '—',
            })}
            children={
              <div className="flex flex-wrap items-center gap-2">
                {row.summary ? <MarketKindBadge kind={row.summary.kind} /> : null}
                {row.updateAvailable ? (
                  <Button type="button" size="sm" disabled={updatingId === row.packageId} onClick={() => void onUpdate(row.packageId)}>
                    {updatingId === row.packageId ? tc('loading') : t('update')}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to={marketPackagePath(row.packageId)}>{t('viewDetail')}</Link>
                </Button>
              </div>
            }
          />
        ))}
      </SettingsSection>
    </PageShell>
  )
}
