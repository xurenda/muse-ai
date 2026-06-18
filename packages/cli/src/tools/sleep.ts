import type { AgentTool } from '@muse-ai/core'
import { Type, type Static } from 'typebox'

const sleepSchema = Type.Object({
  seconds: Type.Number({
    description: 'Sleep duration in seconds (0.1–300). Useful for testing SSE reconnect and steer while a tool is running.',
  }),
  message: Type.Optional(Type.String({ description: 'Optional message echoed after waking up' })),
})

export type SleepToolInput = Static<typeof sleepSchema>

const DEFAULT_MIN_SECONDS = 0.1
const DEFAULT_MAX_SECONDS = 300

export interface SleepToolOptions {
  maxSeconds?: number
  /** 测试注入，避免真实等待 */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Operation aborted'))
      return
    }

    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const onAbort = () => {
      cleanup()
      reject(new Error('Operation aborted'))
    }

    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** 阻塞指定秒数，便于手动测试 streaming / steer / SSE 重连 */
export function createSleepTool(_cwd: string, options?: SleepToolOptions): AgentTool<typeof sleepSchema> {
  const maxSeconds = options?.maxSeconds ?? DEFAULT_MAX_SECONDS
  const sleepFn = options?.sleep ?? defaultSleep

  return {
    name: 'sleep',
    label: 'sleep',
    description:
      'Block for the given number of seconds and return. Intended for manual testing (long-running tool during agent streaming, SSE reconnect, steer/follow-up). Max 300 seconds.',
    parameters: sleepSchema,
    async execute(_toolCallId, { seconds, message }, signal) {
      if (signal?.aborted) throw new Error('Operation aborted')

      if (!Number.isFinite(seconds) || seconds < DEFAULT_MIN_SECONDS) {
        throw new Error(`seconds must be at least ${DEFAULT_MIN_SECONDS}`)
      }
      if (seconds > maxSeconds) {
        throw new Error(`seconds must not exceed ${maxSeconds}`)
      }

      const startedAt = Date.now()
      await sleepFn(Math.round(seconds * 1000), signal)
      const elapsedMs = Date.now() - startedAt

      const text = message ? `Slept ${(elapsedMs / 1000).toFixed(1)}s. ${message}` : `Slept ${(elapsedMs / 1000).toFixed(1)}s.`

      return {
        content: [{ type: 'text', text }],
        details: { requestedSeconds: seconds, elapsedMs },
      }
    },
  }
}
