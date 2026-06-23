import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Device, PairInitResponse } from '@muse-ai/shared'
import { BackendApiError, checkCliHealth, getDeviceCredentials, initDevicePair, listDevices } from '@/api/backend-client'
import { PageShell } from '@/components/layout/page-shell'
import { SettingsRow } from '@/components/settings/settings-row'
import { SettingsSection } from '@/components/settings/settings-section'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'

export function DevicesPage() {
  const { t } = useTranslation('device')
  const { t: tc } = useTranslation('common')
  const { auth, setDeviceSession, getValidAccessToken } = useAuth()
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
    void getValidAccessToken()
      .then(token => listDevices(token))
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
  }, [auth, getValidAccessToken, tc])

  async function onGeneratePairCode() {
    if (!auth) return
    setPairLoading(true)
    try {
      const token = await getValidAccessToken()
      const result = await initDevicePair(token)
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
      const token = await getValidAccessToken()
      const credentials = await getDeviceCredentials(token, device.id)
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
    <PageShell title={t('title')} subtitle={t('subtitle')}>
      {error ? <p className="px-1 text-sm text-destructive">{error}</p> : null}

      <SettingsSection title={t('pairTitle')}>
        <div className="flex flex-col gap-4 px-4 py-3.5">
          <Button type="button" onClick={() => void onGeneratePairCode()} disabled={pairLoading}>
            {pairLoading ? tc('loading') : t('pairGenerate')}
          </Button>
          {pairInfo ? (
            <div className="space-y-2 rounded-lg border border-sidebar-border bg-background/60 p-4">
              <p className="text-sm">
                {t('pairCode')}: <span className="font-mono text-lg tracking-widest text-primary">{pairInfo.pairCode}</span>
              </p>
              <p className="text-xs text-muted-foreground">{t('pairExpires', { expiresAt: new Date(pairInfo.expiresAt).toLocaleString() })}</p>
              <p className="text-sm text-muted-foreground">{t('pairHint')}</p>
              <code className="block rounded bg-muted px-3 py-2 font-mono text-sm">{t('pairCommand', { code: pairInfo.pairCode })}</code>
            </div>
          ) : null}
        </div>
      </SettingsSection>

      <SettingsSection title={t('listTitle')}>
        {loading ? <p className="px-4 py-3.5 text-sm text-muted-foreground">{tc('loading')}</p> : null}
        {!loading && devices.length === 0 ? <p className="px-4 py-3.5 text-sm text-muted-foreground">{t('empty')}</p> : null}
        {!loading
          ? devices.map(device => (
              <SettingsRow key={device.id} title={device.name} description={device.endpoint ?? '—'}>
                <span
                  className={`text-xs ${device.online ? 'text-success' : 'text-muted-foreground'}`}
                  title={device.online ? t('registryOnline') : t('registryOffline')}
                >
                  {device.online ? t('registryOnline') : t('registryOffline')}
                </span>
                <Button type="button" size="sm" disabled={connectingId === device.id} onClick={() => void onSelectDevice(device)}>
                  {connectingId === device.id ? t('connecting') : t('select')}
                </Button>
              </SettingsRow>
            ))
          : null}
      </SettingsSection>
    </PageShell>
  )
}
