import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { subscribeDeviceEvents } from '@/api/cli-client'
import { useAuth } from '@/hooks/use-auth'
import type { StoredDeviceSession } from '@/lib/config'
import { useSessionListStore } from '@/stores/session-list-store'
import { useDeviceStatusStore, type DeviceSseStatus } from '@/stores/device-status-store'

interface DeviceHealthContextValue {
  /** null 表示未选设备或尚未连上设备 SSE */
  reachable: boolean | null
  checking: boolean
  deviceSseStatus: DeviceSseStatus
  reconnectInMs: number | null
  refresh: () => void
}

const IDLE_DEVICE_HEALTH: DeviceHealthContextValue = {
  reachable: null,
  checking: false,
  deviceSseStatus: 'idle',
  reconnectInMs: null,
  refresh: () => {},
}

const DeviceHealthContext = createContext<DeviceHealthContextValue | null>(null)

function DeviceHealthSubscription({ deviceSession, children }: { deviceSession: StoredDeviceSession; children: ReactNode }) {
  const [reachable, setReachable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(false)
  const [deviceSseStatus, setDeviceSseStatus] = useState<DeviceSseStatus>('idle')
  const [reconnectInMs, setReconnectInMs] = useState<number | null>(null)

  const setDeviceSseState = useDeviceStatusStore(state => state.setDeviceSseState)
  const registerDeviceRetryHandler = useDeviceStatusStore(state => state.registerDeviceRetryHandler)
  const requestSessionRefresh = useSessionListStore(state => state.requestRefresh)

  const retryNowRef = useRef<(() => void) | null>(null)

  const refresh = useCallback(() => {
    retryNowRef.current?.()
  }, [])

  useEffect(() => {
    setDeviceSseState({ status: deviceSseStatus, reconnectInMs })
  }, [deviceSseStatus, reconnectInMs, setDeviceSseState])

  useEffect(() => {
    const abort = new AbortController()

    const { retryNow } = subscribeDeviceEvents(
      deviceSession.endpoint,
      deviceSession.accessToken,
      {
        onConnecting: () => {
          setChecking(true)
          setDeviceSseStatus('connecting')
          setReconnectInMs(null)
          setReachable(null)
        },
        onConnected: () => {
          setChecking(false)
          setDeviceSseStatus('connected')
          setReconnectInMs(null)
          setReachable(true)
        },
        onConnectFailed: () => {
          setReachable(false)
        },
        onReconnecting: delayMs => {
          setChecking(false)
          setDeviceSseStatus('reconnecting')
          setReconnectInMs(delayMs)
          setReachable(false)
        },
        onCountdown: remainingMs => {
          setReconnectInMs(remainingMs)
        },
        onReconnected: () => {
          setDeviceSseStatus('connected')
          setReconnectInMs(null)
          setReachable(true)
          requestSessionRefresh()
        },
        onEvent: event => {
          if (event.type === 'shutting_down') {
            setReachable(false)
            setDeviceSseStatus('disconnected')
          }
          if (event.type === 'session_registry_changed') {
            requestSessionRefresh()
          }
        },
      },
      abort.signal,
    )

    retryNowRef.current = retryNow
    registerDeviceRetryHandler(async () => {
      retryNow()
    })

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        retryNow()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      abort.abort()
      retryNowRef.current = null
      registerDeviceRetryHandler(null)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [deviceSession.accessToken, deviceSession.endpoint, registerDeviceRetryHandler, requestSessionRefresh])

  const value = useMemo(
    () => ({ reachable, checking, deviceSseStatus, reconnectInMs, refresh }),
    [reachable, checking, deviceSseStatus, reconnectInMs, refresh],
  )

  return <DeviceHealthContext.Provider value={value}>{children}</DeviceHealthContext.Provider>
}

export function DeviceHealthProvider({ children }: { children: ReactNode }) {
  const { deviceSession } = useAuth()
  const setDeviceSseState = useDeviceStatusStore(state => state.setDeviceSseState)
  const registerDeviceRetryHandler = useDeviceStatusStore(state => state.registerDeviceRetryHandler)

  useEffect(() => {
    if (deviceSession) return
    setDeviceSseState({ status: 'idle', reconnectInMs: null })
    registerDeviceRetryHandler(null)
  }, [deviceSession, registerDeviceRetryHandler, setDeviceSseState])

  if (!deviceSession) {
    return <DeviceHealthContext.Provider value={IDLE_DEVICE_HEALTH}>{children}</DeviceHealthContext.Provider>
  }

  return (
    <DeviceHealthSubscription key={deviceSession.deviceId} deviceSession={deviceSession}>
      {children}
    </DeviceHealthSubscription>
  )
}

export function useDeviceHealth(): DeviceHealthContextValue {
  const ctx = useContext(DeviceHealthContext)
  if (!ctx) {
    throw new Error('useDeviceHealth 必须在 DeviceHealthProvider 内使用')
  }
  return ctx
}
