import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { MarketPackageSummary } from '@museai/shared'
import { listMarketPackages } from '@/api/backend-client'
import { MarketKindBadge } from '@/components/market/market-kind-badge'
import { PageShell } from '@/components/layout/page-shell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { marketPackagePath } from '@/lib/market-package-path'

export function MarketListPage() {
  const { t } = useTranslation('market')
  const { t: tc } = useTranslation('common')
  const { getValidAccessToken } = useAuth()
  const [packages, setPackages] = useState<MarketPackageSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const token = await getValidAccessToken()
        const body = await listMarketPackages(token)
        setPackages(body.packages)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('loadFailed'))
      } finally {
        setLoading(false)
      }
    })()
  }, [getValidAccessToken, t])

  return (
    <PageShell title={t('title')} subtitle={t('subtitle')}>
      <div className="flex items-center justify-end gap-2 px-1">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link to="/market/installed">{t('installedLink')}</Link>
        </Button>
      </div>

      {loading ? <p className="px-1 text-sm text-muted-foreground">{tc('loading')}</p> : null}
      {error ? <p className="px-1 text-sm text-destructive">{error}</p> : null}

      {!loading && !error && packages.length === 0 ? <p className="px-1 text-sm text-muted-foreground">{t('empty')}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {packages.map(pkg => (
          <Link
            key={pkg.id}
            to={marketPackagePath(pkg.id)}
            className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-4 transition-colors hover:border-border/80 hover:bg-card/70"
          >
            <div className="flex flex-wrap items-center gap-2">
              <MarketKindBadge kind={pkg.kind} />
              <span className="text-xs text-muted-foreground">{pkg.author}</span>
            </div>
            <div>
              <h2 className="font-medium text-foreground">{pkg.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{pkg.description ?? t('noDescription')}</p>
            </div>
            <p className="mt-auto text-xs text-muted-foreground">{t('latestVersionBadge', { version: pkg.latestVersion })}</p>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
