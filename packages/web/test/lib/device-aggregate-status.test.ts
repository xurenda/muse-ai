import { describe, expect, it } from 'vitest'
import { resolveDeviceAggregateStatus } from '@/lib/device-aggregate-status'

const base = {
  hasDevice: true,
  healthReachable: true,
  healthChecking: false,
  chatActive: true,
  chatStatus: 'ready' as const,
  sseStatus: 'connected' as const,
  connectionError: null,
}

describe('resolveDeviceAggregateStatus', () => {
  it('无设备时应为 no_device', () => {
    expect(resolveDeviceAggregateStatus({ ...base, hasDevice: false })).toBe('no_device')
  })

  it('health 不可达时应为 unreachable', () => {
    expect(resolveDeviceAggregateStatus({ ...base, healthReachable: false })).toBe('unreachable')
  })

  it('health 通过但会话失败时应为 session_disconnected 而非连接失败', () => {
    expect(
      resolveDeviceAggregateStatus({
        ...base,
        chatStatus: 'error',
        connectionError: { code: 'unknown', detail: 'Failed to fetch' },
        sseStatus: 'disconnected',
      }),
    ).toBe('session_disconnected')
  })

  it('SSE 重连中应为 reconnecting', () => {
    expect(resolveDeviceAggregateStatus({ ...base, sseStatus: 'reconnecting' })).toBe('reconnecting')
  })
})
