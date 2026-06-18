import type { ParsedConnectionError } from '@/lib/connection-errors'
import type { ChatSessionStatus, SseConnectionStatus } from '@/hooks/use-chat-session'

export type DeviceSseStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

export type DeviceAggregateStatus = 'no_device' | 'checking' | 'connecting' | 'unreachable' | 'reconnecting' | 'session_disconnected' | 'ready'

export interface DeviceStatusInputs {
  hasDevice: boolean
  healthReachable: boolean | null
  healthChecking: boolean
  deviceSseStatus: DeviceSseStatus
  chatActive: boolean
  chatStatus: ChatSessionStatus
  sseStatus: SseConnectionStatus
  connectionError: ParsedConnectionError | null
}

function isSessionFailed(inputs: DeviceStatusInputs): boolean {
  return inputs.chatActive && (inputs.connectionError !== null || inputs.chatStatus === 'error')
}

/** 合并设备 SSE 与 Session SSE：CLI 不可达与会话/SSE 异常分开表示 */
export function resolveDeviceAggregateStatus(inputs: DeviceStatusInputs): DeviceAggregateStatus {
  if (!inputs.hasDevice) return 'no_device'
  if (inputs.deviceSseStatus === 'connecting' || inputs.healthChecking) return 'checking'
  if (inputs.deviceSseStatus === 'reconnecting') return 'reconnecting'
  if (inputs.healthReachable === false || inputs.deviceSseStatus === 'disconnected') return 'unreachable'

  if (isSessionFailed(inputs)) {
    if (inputs.chatStatus === 'connecting' || inputs.sseStatus === 'connecting') return 'connecting'
    if (inputs.sseStatus === 'reconnecting') return 'reconnecting'
    return 'session_disconnected'
  }

  if (inputs.chatActive && inputs.sseStatus === 'reconnecting') return 'reconnecting'
  if (inputs.chatActive && (inputs.chatStatus === 'connecting' || inputs.sseStatus === 'connecting')) return 'connecting'
  return 'ready'
}

export function isDeviceStatusFailure(status: DeviceAggregateStatus): boolean {
  return status === 'unreachable' || status === 'session_disconnected'
}
