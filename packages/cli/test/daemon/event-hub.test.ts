import { describe, expect, it } from 'vitest'
import { SessionEventHub, createSseSubscriber } from '@/daemon/event-hub.js'

describe('SessionEventHub', () => {
  it('应向订阅者广播事件', async () => {
    const hub = new SessionEventHub()
    const received: string[] = []
    const abort = new AbortController()

    hub.subscribe(
      'session-1',
      createSseSubscriber(abort.signal, async event => {
        received.push(event.type)
      }),
    )

    await hub.publish('session-1', { type: 'turn_start' })
    await hub.publish('session-1', { type: 'turn_end' })

    expect(received).toEqual(['turn_start', 'turn_end'])
  })

  it('无订阅者时应缓冲并在订阅后回放', async () => {
    const hub = new SessionEventHub()
    const received: string[] = []
    const abort = new AbortController()

    await hub.publish('session-1', { type: 'agent_start' })
    await hub.publish('session-1', { type: 'text_delta', delta: 'hi' })

    hub.subscribe(
      'session-1',
      createSseSubscriber(abort.signal, async event => {
        received.push(event.type)
      }),
    )

    await new Promise<void>(resolve => {
      setTimeout(resolve, 0)
    })

    expect(received).toEqual(['agent_start', 'text_delta'])
  })
})
