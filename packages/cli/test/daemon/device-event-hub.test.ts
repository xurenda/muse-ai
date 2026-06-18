import { describe, expect, it, vi } from 'vitest'
import { DeviceEventHub, createDeviceSseSubscriber, publishSessionRegistryChanged } from '@/daemon/device-event-hub'

describe('DeviceEventHub', () => {
  it('应向订阅者广播事件', async () => {
    const hub = new DeviceEventHub()
    const abort = new AbortController()
    const write = vi.fn().mockResolvedValue(undefined)

    hub.subscribe(createDeviceSseSubscriber(abort.signal, write))
    await hub.publish({ type: 'ping' })

    expect(write).toHaveBeenCalledWith({ type: 'ping' })
  })

  it('session_registry_changed 应携带 reason', async () => {
    const hub = new DeviceEventHub()
    const abort = new AbortController()
    const write = vi.fn().mockResolvedValue(undefined)

    hub.subscribe(createDeviceSseSubscriber(abort.signal, write))
    await publishSessionRegistryChanged(hub, 'created')

    expect(write).toHaveBeenCalledWith({ type: 'session_registry_changed', reason: 'created' })
  })

  it('abort 后应移除订阅者', async () => {
    const hub = new DeviceEventHub()
    const abort = new AbortController()
    const write = vi.fn().mockResolvedValue(undefined)

    hub.subscribe(createDeviceSseSubscriber(abort.signal, write))
    abort.abort()
    await hub.publish({ type: 'ping' })

    expect(write).toHaveBeenCalledTimes(0)
  })
})
