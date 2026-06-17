import { afterEach, describe, expect, it, vi } from 'vitest'
import { subscribeSessionEvents } from '@/api/cli-client'

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  let index = 0
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(encoder.encode(chunks[index]))
      index += 1
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
