import { randomUUID } from 'node:crypto'
import type { MuseSseEvent } from '@muse-ai/shared'

export interface SseSubscriber {
  id: string
  write: (event: MuseSseEvent) => Promise<void>
  signal: AbortSignal
}

/** 按 session 广播 Muse SSE 事件 */
export class SessionEventHub {
  private readonly subscribers = new Map<string, Map<string, SseSubscriber>>()

  subscribe(sessionId: string, subscriber: SseSubscriber): () => void {
    let sessionSubs = this.subscribers.get(sessionId)
    if (!sessionSubs) {
      sessionSubs = new Map()
      this.subscribers.set(sessionId, sessionSubs)
    }
    sessionSubs.set(subscriber.id, subscriber)

    const onAbort = () => {
      this.unsubscribe(sessionId, subscriber.id)
    }
    subscriber.signal.addEventListener('abort', onAbort, { once: true })

    return () => {
      subscriber.signal.removeEventListener('abort', onAbort)
      this.unsubscribe(sessionId, subscriber.id)
    }
  }

  private unsubscribe(sessionId: string, subscriberId: string): void {
    const sessionSubs = this.subscribers.get(sessionId)
    if (!sessionSubs) return
    sessionSubs.delete(subscriberId)
    if (sessionSubs.size === 0) {
      this.subscribers.delete(sessionId)
    }
  }

  async publish(sessionId: string, event: MuseSseEvent): Promise<void> {
    const sessionSubs = this.subscribers.get(sessionId)
    if (!sessionSubs) return

    const dead: string[] = []
    for (const [id, subscriber] of sessionSubs) {
      if (subscriber.signal.aborted) {
        dead.push(id)
        continue
      }
      try {
        await subscriber.write(event)
      } catch {
        dead.push(id)
      }
    }
    for (const id of dead) {
      sessionSubs.delete(id)
    }
  }

  hasSubscribers(sessionId: string): boolean {
    return (this.subscribers.get(sessionId)?.size ?? 0) > 0
  }
}

export function createSseSubscriber(signal: AbortSignal, write: (event: MuseSseEvent) => Promise<void>): SseSubscriber {
  return {
    id: randomUUID(),
    write,
    signal,
  }
}
