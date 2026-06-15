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
})
