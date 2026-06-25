import { randomUUID } from 'node:crypto'
import type { DeviceSseEvent } from '@museai/shared'

export interface DeviceSseSubscriber {
  id: string
  write: (event: DeviceSseEvent) => Promise<void>
  signal: AbortSignal
}

/** 设备级 SSE 广播（单 daemon 多 Web 订阅者） */
export class DeviceEventHub {
  private readonly subscribers = new Map<string, DeviceSseSubscriber>()

  subscribe(subscriber: DeviceSseSubscriber): () => void {
    this.subscribers.set(subscriber.id, subscriber)

    const onAbort = () => {
      this.unsubscribe(subscriber.id)
    }
    subscriber.signal.addEventListener('abort', onAbort, { once: true })

    return () => {
      subscriber.signal.removeEventListener('abort', onAbort)
      this.unsubscribe(subscriber.id)
    }
  }

  private unsubscribe(subscriberId: string): void {
    this.subscribers.delete(subscriberId)
  }

  async publish(event: DeviceSseEvent): Promise<void> {
    const dead: string[] = []
    for (const [id, subscriber] of this.subscribers) {
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
      this.subscribers.delete(id)
    }
  }

  async publishShuttingDown(): Promise<void> {
    await this.publish({ type: 'shutting_down' })
  }
}

export function createDeviceSseSubscriber(signal: AbortSignal, write: (event: DeviceSseEvent) => Promise<void>): DeviceSseSubscriber {
  return {
    id: randomUUID(),
    write,
    signal,
  }
}

export type SessionRegistryChangeReason = 'created' | 'deleted' | 'renamed'

export async function publishSessionRegistryChanged(hub: DeviceEventHub, reason: SessionRegistryChangeReason): Promise<void> {
  await hub.publish({ type: 'session_registry_changed', reason })
}
