import { randomUUID } from 'node:crypto'
import type { MuseSseEvent } from '@museai/shared'

export interface SseSubscriber {
  id: string
  write: (event: MuseSseEvent) => Promise<void>
  signal: AbortSignal
}

const MAX_PENDING_EVENTS = 200

/** 按 session 广播 Muse SSE 事件 */
export class SessionEventHub {
  private readonly subscribers = new Map<string, Map<string, SseSubscriber>>()
  /** 尚无订阅者时暂存，避免 Web 尚未连上 SSE 就丢事件 */
  private readonly pendingEvents = new Map<string, MuseSseEvent[]>()

  subscribe(sessionId: string, subscriber: SseSubscriber): () => void {
    let sessionSubs = this.subscribers.get(sessionId)
    if (!sessionSubs) {
      sessionSubs = new Map()
      this.subscribers.set(sessionId, sessionSubs)
    }
    sessionSubs.set(subscriber.id, subscriber)
    void this.replayPending(sessionId, subscriber)

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

  private enqueuePending(sessionId: string, event: MuseSseEvent): void {
    const queue = this.pendingEvents.get(sessionId) ?? []
    queue.push(event)
    if (queue.length > MAX_PENDING_EVENTS) {
      queue.splice(0, queue.length - MAX_PENDING_EVENTS)
    }
    this.pendingEvents.set(sessionId, queue)
  }

  private async replayPending(sessionId: string, subscriber: SseSubscriber): Promise<void> {
    const pending = this.pendingEvents.get(sessionId)
    if (!pending?.length) return
    this.pendingEvents.delete(sessionId)

    for (const event of pending) {
      if (subscriber.signal.aborted) return
      try {
        await subscriber.write(event)
      } catch {
        return
      }
    }
  }

  async publish(sessionId: string, event: MuseSseEvent): Promise<void> {
    const sessionSubs = this.subscribers.get(sessionId)
    if (!sessionSubs || sessionSubs.size === 0) {
      this.enqueuePending(sessionId, event)
      return
    }

    const dead: string[] = []
    let delivered = false
    for (const [id, subscriber] of sessionSubs) {
      if (subscriber.signal.aborted) {
        dead.push(id)
        continue
      }
      try {
        await subscriber.write(event)
        delivered = true
      } catch {
        dead.push(id)
      }
    }
    for (const id of dead) {
      sessionSubs.delete(id)
    }
    if (sessionSubs.size === 0) {
      this.subscribers.delete(sessionId)
    }
    if (!delivered) {
      this.enqueuePending(sessionId, event)
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
