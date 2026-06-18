import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackendClient } from '@/backend/client.js'
import { REGISTRY_HEARTBEAT_INTERVAL_MS, sendDeviceRegistryHeartbeat, startDeviceRegistryHeartbeat } from '@/daemon/heartbeat.js'
import { loadCliConfig } from '@/config.js'

describe('BackendClient heartbeat', () => {
  it('应支持 online: false', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ device: {} }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const client = new BackendClient('http://127.0.0.1:65435')
    await client.heartbeat('device-token', { endpoint: 'http://127.0.0.1:65433', online: false })

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:65435/devices/heartbeat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ endpoint: 'http://127.0.0.1:65433', online: false }),
      }),
    )

    vi.unstubAllGlobals()
  })
})

describe('设备目录心跳', () => {
  let tempHome: string
  const originalHome = process.env.MUSE_HOME

  beforeEach(async () => {
    tempHome = await mkdtemp(join(tmpdir(), 'muse-heartbeat-'))
    process.env.MUSE_HOME = tempHome
    await writeFile(
      join(tempHome, 'config.json'),
      JSON.stringify({
        version: 1,
        backendUrl: 'http://127.0.0.1:65435',
        deviceId: '00000000-0000-4000-8000-000000000001',
        deviceToken: 'test-device-token',
      }),
      'utf8',
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    if (originalHome === undefined) delete process.env.MUSE_HOME
    else process.env.MUSE_HOME = originalHome
  })

  it('sendDeviceRegistryHeartbeat 应上报 online 与 endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ device: {} }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await sendDeviceRegistryHeartbeat(loadCliConfig({ MUSE_CLI_HOST: '127.0.0.1', MUSE_CLI_PORT: '65433' }), true)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({
      endpoint: 'http://127.0.0.1:65433',
      online: true,
    })
  })

  it('stop 时应上报 offline 并停止定时器', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ device: {} }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const stop = startDeviceRegistryHeartbeat(loadCliConfig({ MUSE_CLI_HOST: '127.0.0.1', MUSE_CLI_PORT: '65433' }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    vi.advanceTimersByTime(REGISTRY_HEARTBEAT_INTERVAL_MS)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    await stop()

    expect(JSON.parse(String((fetchMock.mock.calls[2] as [string, RequestInit])[1].body))).toEqual({
      endpoint: 'http://127.0.0.1:65433',
      online: false,
    })

    vi.advanceTimersByTime(REGISTRY_HEARTBEAT_INTERVAL_MS * 2)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
