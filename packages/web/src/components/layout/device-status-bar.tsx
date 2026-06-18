import { Activity } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { resolveDeviceAggregateStatus, type DeviceAggregateStatus } from '@/lib/device-aggregate-status'
import { formatConnectionErrorMessage } from '@/lib/connection-errors'
import { cn } from '@/lib/utils'
import { useDeviceStatusStore } from '@/stores/device-status-store'

const STATUS_LABEL_KEYS: Record<DeviceAggregateStatus, string> = {
  no_device: 'statusBar.noDevice',
  checking: 'statusBar.checking',
  connecting: 'statusBar.connecting',
  unreachable: 'statusBar.unreachable',
  reconnecting: 'statusBar.reconnecting',
  session_disconnected: 'statusBar.sessionDisconnected',
  ready: 'statusBar.ready',
}

function statusDotClass(status: DeviceAggregateStatus): string {
  switch (status) {
    case 'ready':
      return 'bg-success'
    case 'reconnecting':
    case 'checking':
    case 'connecting':
      return 'bg-muted-foreground animate-pulse'
    case 'session_disconnected':
    case 'unreachable':
      return 'bg-destructive'
    default:
      return 'bg-muted-foreground'
  }
}

function DeviceStatusPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('layout')
  const { t: tc } = useTranslation('chat')
  const panelRef = useRef<HTMLDivElement>(null)

  const deviceName = useDeviceStatusStore(state => state.deviceName)
  const deviceEndpoint = useDeviceStatusStore(state => state.deviceEndpoint)
  const hasDevice = useDeviceStatusStore(state => state.hasDevice)
  const healthReachable = useDeviceStatusStore(state => state.healthReachable)
  const healthChecking = useDeviceStatusStore(state => state.healthChecking)
  const deviceSseStatus = useDeviceStatusStore(state => state.deviceSseStatus)
  const deviceReconnectInMs = useDeviceStatusStore(state => state.deviceReconnectInMs)
  const chatActive = useDeviceStatusStore(state => state.chatActive)
  const chatStatus = useDeviceStatusStore(state => state.chatStatus)
  const sseStatus = useDeviceStatusStore(state => state.sseStatus)
  const connectionError = useDeviceStatusStore(state => state.connectionError)
  const activities = useDeviceStatusStore(state => state.activities)
  const retryInProgress = useDeviceStatusStore(state => state.retryInProgress)
  const invokeRetry = useDeviceStatusStore(state => state.invokeRetry)
  const retryHandler = useDeviceStatusStore(state => state.retryHandler)
  const deviceRetryHandler = useDeviceStatusStore(state => state.deviceRetryHandler)
  const invokeDeviceRetry = useDeviceStatusStore(state => state.invokeDeviceRetry)

  const aggregate = resolveDeviceAggregateStatus({
    hasDevice,
    healthReachable,
    healthChecking,
    deviceSseStatus,
    chatActive,
    chatStatus,
    sseStatus,
    connectionError,
  })

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-device-status-trigger]')) return
      onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [onClose])

  const healthLabel = healthChecking
    ? t('statusBar.panel.healthChecking')
    : healthReachable
      ? t('statusBar.panel.healthOk')
      : healthReachable === false
        ? t('statusBar.panel.healthFail')
        : t('statusBar.panel.healthUnknown')

  let sseLabel = t('statusBar.panel.sseIdle')
  if (chatActive) {
    if (sseStatus === 'connected') sseLabel = t('statusBar.panel.sseConnected')
    else if (sseStatus === 'reconnecting') sseLabel = t('statusBar.panel.sseReconnecting')
    else if (sseStatus === 'connecting') sseLabel = t('statusBar.panel.sseConnecting')
    else if (sseStatus === 'disconnected') sseLabel = t('statusBar.panel.sseDisconnected')
  }

  const showError = connectionError !== null && aggregate !== 'ready'
  const showChatRetry = showError && retryHandler !== null
  const showDeviceRetry = deviceSseStatus === 'reconnecting' && deviceRetryHandler !== null
  const reconnectSeconds = deviceReconnectInMs !== null ? Math.max(0, Math.ceil(deviceReconnectInMs / 1000)) : null

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full left-2 z-50 mb-1 w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
      role="dialog"
      aria-label={t('statusBar.panel.title')}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <Activity className="size-4 text-primary" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{deviceName ?? t('statusBar.panel.noDeviceTitle')}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('inline-block size-1.5 rounded-full', statusDotClass(aggregate))} />
            {t(STATUS_LABEL_KEYS[aggregate])}
          </p>
        </div>
      </div>

      <div className="space-y-2 px-3 py-2.5 text-xs">
        {hasDevice && deviceEndpoint ? (
          <div className="flex gap-2">
            <span className="shrink-0 text-muted-foreground">{t('statusBar.panel.endpoint')}</span>
            <span className="min-w-0 break-all font-mono">{deviceEndpoint}</span>
          </div>
        ) : null}
        <div className="flex gap-2">
          <span className="shrink-0 text-muted-foreground">{t('statusBar.panel.health')}</span>
          <span>{healthLabel}</span>
        </div>
        <div className="flex gap-2">
          <span className="shrink-0 text-muted-foreground">{t('statusBar.panel.sse')}</span>
          <span>{sseLabel}</span>
        </div>
      </div>

      {showDeviceRetry ? (
        <div className="border-t border-border px-3 py-2.5">
          {reconnectSeconds !== null && reconnectSeconds > 0 ? (
            <p className="text-xs text-muted-foreground">{t('statusBar.panel.deviceReconnectIn', { seconds: reconnectSeconds })}</p>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="mt-2 h-7 text-xs" disabled={retryInProgress} onClick={() => void invokeDeviceRetry()}>
            {retryInProgress ? tc('retryConnecting') : t('statusBar.panel.deviceReconnectNow')}
          </Button>
        </div>
      ) : null}

      {showError ? (
        <div className="border-t border-border px-3 py-2.5">
          <p className="text-xs text-destructive">{formatConnectionErrorMessage(connectionError, tc)}</p>
          {showChatRetry ? (
            <Button type="button" variant="outline" size="sm" className="mt-2 h-7 text-xs" disabled={retryInProgress} onClick={() => void invokeRetry()}>
              {retryInProgress ? tc('retryConnecting') : tc('retryConnection')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {activities.length > 0 ? (
        <div className="border-t border-border px-3 py-2.5">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('statusBar.panel.recentActivity')}</p>
          <ul className="max-h-28 space-y-1 overflow-y-auto font-mono text-[11px] leading-relaxed text-muted-foreground">
            {activities.map(entry => (
              <li key={entry.id} className="truncate">
                <span className="text-foreground/70">{new Date(entry.at).toLocaleTimeString()}</span> {t(entry.messageKey, entry.messageParams)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-border px-3 py-2">
        <Link to="/devices" className="text-xs text-primary hover:underline" onClick={onClose}>
          {t('statusBar.panel.manageDevices')} →
        </Link>
      </div>
    </div>
  )
}

export function DeviceStatusBar() {
  const { t } = useTranslation('layout')
  const panelOpen = useDeviceStatusStore(state => state.panelOpen)
  const closePanel = useDeviceStatusStore(state => state.closePanel)
  const openPanel = useDeviceStatusStore(state => state.openPanel)

  const hasDevice = useDeviceStatusStore(state => state.hasDevice)
  const healthReachable = useDeviceStatusStore(state => state.healthReachable)
  const healthChecking = useDeviceStatusStore(state => state.healthChecking)
  const deviceSseStatus = useDeviceStatusStore(state => state.deviceSseStatus)
  const chatActive = useDeviceStatusStore(state => state.chatActive)
  const chatStatus = useDeviceStatusStore(state => state.chatStatus)
  const sseStatus = useDeviceStatusStore(state => state.sseStatus)
  const connectionError = useDeviceStatusStore(state => state.connectionError)

  const aggregate = resolveDeviceAggregateStatus({
    hasDevice,
    healthReachable,
    healthChecking,
    deviceSseStatus,
    chatActive,
    chatStatus,
    sseStatus,
    connectionError,
  })

  return (
    <div className="relative shrink-0 border-t border-border bg-muted/30">
      {panelOpen ? <DeviceStatusPanel onClose={closePanel} /> : null}

      <div className="flex h-5 items-stretch px-1">
        <button
          type="button"
          data-device-status-trigger
          className={cn(
            'inline-flex max-w-full items-center gap-1.5 px-2 text-left text-[11px] leading-none transition-colors',
            panelOpen ? 'bg-foreground/6 text-foreground' : 'text-muted-foreground hover:bg-foreground/6 hover:text-foreground',
          )}
          aria-expanded={panelOpen}
          onClick={() => {
            if (panelOpen) closePanel()
            else openPanel(true)
          }}
        >
          <span className={cn('inline-block size-1.5 shrink-0 rounded-full', statusDotClass(aggregate))} />
          <span className="truncate">
            {t('statusBar.device')} · {t(STATUS_LABEL_KEYS[aggregate])}
          </span>
        </button>
      </div>
    </div>
  )
}
