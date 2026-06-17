import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useDeviceHealth } from '@/hooks/use-device-health'
import { isDeviceStatusFailure, resolveDeviceAggregateStatus, type DeviceAggregateStatus } from '@/lib/device-aggregate-status'
import { useDeviceStatusStore } from '@/stores/device-status-store'

const SSE_RECONNECT_AUTO_EXPAND_MS = 3_000
const RECOVERY_AUTO_CLOSE_MS = 2_000

function readAggregate(): DeviceAggregateStatus {
  const state = useDeviceStatusStore.getState()
  return resolveDeviceAggregateStatus({
    hasDevice: state.hasDevice,
    healthReachable: state.healthReachable,
    healthChecking: state.healthChecking,
    chatActive: state.chatActive,
    chatStatus: state.chatStatus,
    sseStatus: state.sseStatus,
    connectionError: state.connectionError,
  })
}

/** 同步设备/健康状态，并处理面板自动展开与收起 */
export function DeviceStatusController() {
  const { deviceSession } = useAuth()
  const { reachable, checking } = useDeviceHealth()

  const setDeviceInfo = useDeviceStatusStore(state => state.setDeviceInfo)
  const setHealth = useDeviceStatusStore(state => state.setHealth)

  const prevAggregateRef = useRef<DeviceAggregateStatus | null>(null)
  const sseReconnectTimerRef = useRef<number | null>(null)
  const recoveryCloseTimerRef = useRef<number | null>(null)
  const autoOpenedRef = useRef(false)

  useEffect(() => {
    setDeviceInfo({
      hasDevice: deviceSession !== null,
      deviceName: deviceSession?.deviceName ?? null,
      deviceEndpoint: deviceSession?.endpoint ?? null,
    })
  }, [deviceSession, setDeviceInfo])

  useEffect(() => {
    setHealth(reachable, checking)
  }, [reachable, checking, setHealth])

  useEffect(() => {
    prevAggregateRef.current = readAggregate()

    const handleTransition = (aggregate: DeviceAggregateStatus, prev: DeviceAggregateStatus | null) => {
      const { openPanel, closePanel, pushActivity } = useDeviceStatusStore.getState()
      const panelOpenedByUser = useDeviceStatusStore.getState().panelOpenedByUser

      if (aggregate === 'unreachable' && prev !== 'unreachable') {
        pushActivity('statusBar.activity.healthLost')
        autoOpenedRef.current = true
        openPanel(false)
      }

      if (aggregate === 'session_disconnected' && prev !== 'session_disconnected') {
        pushActivity('statusBar.activity.connectFailed')
        autoOpenedRef.current = true
        openPanel(false)
      }

      if (aggregate === 'reconnecting' && prev !== 'reconnecting') {
        pushActivity('statusBar.activity.sseReconnecting')
        if (sseReconnectTimerRef.current) window.clearTimeout(sseReconnectTimerRef.current)
        sseReconnectTimerRef.current = window.setTimeout(() => {
          if (readAggregate() === 'reconnecting') {
            autoOpenedRef.current = true
            openPanel(false)
          }
        }, SSE_RECONNECT_AUTO_EXPAND_MS)
      }

      if (aggregate !== 'reconnecting' && sseReconnectTimerRef.current) {
        window.clearTimeout(sseReconnectTimerRef.current)
        sseReconnectTimerRef.current = null
      }

      if (aggregate === 'ready' && prev !== null && prev !== 'ready' && prev !== 'checking' && prev !== 'connecting' && prev !== 'no_device') {
        if (prev === 'unreachable') pushActivity('statusBar.activity.healthRestored')
        if (prev === 'reconnecting') pushActivity('statusBar.activity.sseReconnected')
        if (prev === 'session_disconnected') pushActivity('statusBar.activity.connectRestored')
      }

      if (aggregate === 'ready' && autoOpenedRef.current && !panelOpenedByUser) {
        if (recoveryCloseTimerRef.current) window.clearTimeout(recoveryCloseTimerRef.current)
        recoveryCloseTimerRef.current = window.setTimeout(() => {
          autoOpenedRef.current = false
          closePanel()
        }, RECOVERY_AUTO_CLOSE_MS)
      }

      if (isDeviceStatusFailure(aggregate) && recoveryCloseTimerRef.current) {
        window.clearTimeout(recoveryCloseTimerRef.current)
        recoveryCloseTimerRef.current = null
      }
    }

    const unsubscribe = useDeviceStatusStore.subscribe(() => {
      const aggregate = readAggregate()
      const prev = prevAggregateRef.current
      if (aggregate === prev) return
      prevAggregateRef.current = aggregate
      handleTransition(aggregate, prev)
    })

    return () => {
      unsubscribe()
      if (sseReconnectTimerRef.current) window.clearTimeout(sseReconnectTimerRef.current)
      if (recoveryCloseTimerRef.current) window.clearTimeout(recoveryCloseTimerRef.current)
    }
  }, [])

  return null
}
