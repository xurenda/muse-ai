import type { ParsedConnectionError } from '@/lib/connection-errors'
import type { ChatSessionStatus, SseConnectionStatus } from '@/hooks/use-chat-session'

export type DeviceAggregateStatus = 'no_device' | 'checking' | 'connecting' | 'unreachable' | 'reconnecting' | 'session_disconnected' | 'ready'

export interface DeviceStatusInputs {
  hasDevice: boolean
  healthReachable: boolean | null
  healthChecking: boolean
  chatActive: boolean
  chatStatus: ChatSessionStatus
  sseStatus: SseConnectionStatus
  connectionError: ParsedConnectionError | null
}

function isSessionFailed(inputs: DeviceStatusInputs): boolean {
  return inputs.chatActive && (inputs.connectionError !== null || inputs.chatStatus === 'error')
}

/** 合并 health 与 SSE：CLI 不可达与会话/SSE 异常分开表示 */
export function resolveDeviceAggregateStatus(inputs: DeviceStatusInputs): DeviceAggregateStatus {
  if (!inputs.hasDevice) return 'no_device'
  if (inputs.healthReachable === false) return 'unreachable'
  if (inputs.healthChecking) return 'checking'

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
