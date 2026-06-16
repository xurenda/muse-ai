import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Device, PairInitResponse } from '@muse-ai/shared'
import { BackendApiError, checkCliHealth, getDeviceCredentials, initDevicePair, listDevices } from '@/api/backend-client'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'

export function DevicesPage() {
  const { t } = useTranslation('device')
  const { t: tc } = useTranslation('common')
  const { t: ta } = useTranslation('auth')
  const { auth, logout, setDeviceSession } = useAuth()
  const navigate = useNavigate()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pairInfo, setPairInfo] = useState<PairInitResponse | null>(null)
  const [pairLoading, setPairLoading] = useState(false)
  const [connectingId, setConnectingId] = useState<string | null>(null)

  useEffect(() => {
    if (!auth) return
    let cancelled = false
    void listDevices(auth.accessToken)
      .then(list => {
        if (!cancelled) setDevices(list)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : tc('error'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [auth, tc])

  async function onGeneratePairCode() {
    if (!auth) return
    setPairLoading(true)
    try {
      const result = await initDevicePair(auth.accessToken)
      setPairInfo(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tc('error'))
    } finally {
      setPairLoading(false)
    }
  }

  async function onSelectDevice(device: Device) {
    if (!auth) return
    setConnectingId(device.id)
    setError(null)
    try {
      const credentials = await getDeviceCredentials(auth.accessToken, device.id)
      const ok = await checkCliHealth(credentials.endpoint, credentials.accessToken)
      if (!ok) {
        throw new Error(t('connectFailed'))
      }
      setDeviceSession({
        deviceId: device.id,
        deviceName: device.name,
        endpoint: credentials.endpoint,
        accessToken: credentials.accessToken,
      })
      navigate('/chat')
    } catch (err: unknown) {
      if (err instanceof BackendApiError) {
        if (err.code === 'credentials_unavailable') setError(t('rePairRequired'))
        else if (err.code === 'endpoint_unavailable') setError(t('endpointMissing'))
        else setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : t('credentialsFailed'))
      }
    } finally {
      setConnectingId(null)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl p-6">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Button type="button" variant="outline" size="sm" onClick={logout}>
            {ta('logout')}
          </Button>
        </div>
      </header>

      <section className="mb-8 rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-medium">{t('pairTitle')}</h2>
        <Button type="button" onClick={() => void onGeneratePairCode()} disabled={pairLoading}>
          {pairLoading ? tc('loading') : t('pairGenerate')}
        </Button>
        {pairInfo ? (
          <div className="mt-4 space-y-2 rounded-md border border-border bg-background p-4">
            <p className="text-sm">
              {t('pairCode')}: <span className="font-mono text-lg tracking-widest text-primary">{pairInfo.pairCode}</span>
            </p>
            <p className="text-xs text-muted-foreground">{t('pairExpires', { expiresAt: new Date(pairInfo.expiresAt).toLocaleString() })}</p>
            <p className="text-sm text-muted-foreground">{t('pairHint')}</p>
            <code className="block rounded bg-card px-3 py-2 font-mono text-sm">{t('pairCommand', { code: pairInfo.pairCode })}</code>
          </div>
        ) : null}
      </section>

      {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

      <section className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground">{tc('loading')}</p>
        ) : devices.length === 0 ? (
          <p className="text-muted-foreground">{t('empty')}</p>
        ) : (
          devices.map(device => (
            <div key={device.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
              <div>
                <p className="font-medium">{device.name}</p>
                <p className="text-xs text-muted-foreground">{device.endpoint ?? '—'}</p>
                <p className={`mt-1 text-xs ${device.online ? 'text-success' : 'text-muted-foreground'}`}>{device.online ? tc('online') : tc('offline')}</p>
              </div>
              <Button type="button" disabled={!device.online || connectingId === device.id} onClick={() => void onSelectDevice(device)}>
                {connectingId === device.id ? t('connecting') : t('select')}
              </Button>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
