import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseDeviceSseBuffer, subscribeDeviceEvents, subscribeSessionEvents } from '@/api/cli-client'

function sseResponse(chunks: string[], options?: { hang?: boolean }): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      if (!options?.hang) {
        controller.close()
      }
    },
  })
  return new Response(stream, { status: 200 })
}

describe('subscribeSessionEvents', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('首次连接应触发 onConnected', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(sseResponse(['data: {"type":"agent_end"}\n\n']))
    vi.stubGlobal('fetch', fetchMock)

    const onConnected = vi.fn()
    const abort = new AbortController()

    const subscription = subscribeSessionEvents(
      'http://127.0.0.1:65433',
      'token',
      '00000000-0000-4000-8000-000000000001',
      { onEvent: () => {}, onConnected },
      abort.signal,
    )

    await vi.waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1))
    abort.abort()
    await subscription.catch(() => {})
  })

  it('断线重连应触发 onReconnecting 与 onReconnected', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(sseResponse([])).mockResolvedValueOnce(sseResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    const onConnected = vi.fn()
    const onReconnecting = vi.fn()
    const onReconnected = vi.fn()
    const abort = new AbortController()

    const subscription = subscribeSessionEvents(
      'http://127.0.0.1:65433',
      'token',
      '00000000-0000-4000-8000-000000000001',
      { onEvent: () => {}, onConnected, onReconnecting, onReconnected },
      abort.signal,
    )

    await vi.waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(onReconnecting).toHaveBeenCalledTimes(1), { timeout: 3000 })
    await vi.waitFor(() => expect(onReconnected).toHaveBeenCalledTimes(1), { timeout: 3000 })

    abort.abort()
    await subscription.catch(() => {})
  })
})

describe('parseDeviceSseBuffer', () => {
  it('应解析设备 SSE 行并保留 remainder', () => {
    const { events, remainder } = parseDeviceSseBuffer('data: {"type":"ping"}\npartial')
    expect(events).toEqual([{ type: 'ping' }])
    expect(remainder).toBe('partial')
  })
})

describe('subscribeDeviceEvents', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('首次连接应触发 onConnecting 与 onConnected', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(sseResponse(['data: {"type":"connected","endpoint":"http://127.0.0.1:65433","service":"cli"}\n\n'], { hang: true }))
    vi.stubGlobal('fetch', fetchMock)

    const onConnecting = vi.fn()
    const onConnected = vi.fn()
    const abort = new AbortController()

    subscribeDeviceEvents('http://127.0.0.1:65433', 'token', { onEvent: () => {}, onConnecting, onConnected }, abort.signal)

    await vi.waitFor(() => expect(onConnecting).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(onConnected).toHaveBeenCalledTimes(1))
    abort.abort()
  })
})
