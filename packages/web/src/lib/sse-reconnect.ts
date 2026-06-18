export const DEVICE_SSE_BACKOFF_INITIAL_MS = 1_000
export const DEVICE_SSE_BACKOFF_MAX_MS = 30_000

/** 指数退避：1s, 2s, 4s … 上限 30s */
export function computeSseBackoffMs(attempt: number, initialMs = DEVICE_SSE_BACKOFF_INITIAL_MS, maxMs = DEVICE_SSE_BACKOFF_MAX_MS): number {
  if (attempt <= 0) return 0
  return Math.min(maxMs, initialMs * 2 ** (attempt - 1))
}

export type SseRetryWaitResult = 'elapsed' | 'aborted' | 'wake'

/** 等待重连；支持倒计时回调与外部 wake（立即重连） */
export async function waitForSseRetry(options: {
  delayMs: number
  signal: AbortSignal
  onCountdown?: (remainingMs: number) => void
  registerWake?: (wake: () => void) => void
  countdownTickMs?: number
}): Promise<SseRetryWaitResult> {
  const { delayMs, signal, onCountdown, registerWake, countdownTickMs = 250 } = options

  if (signal.aborted) return 'aborted'
  if (delayMs <= 0) return 'elapsed'

  return new Promise(resolve => {
    let remainingMs = delayMs
    onCountdown?.(remainingMs)

    const onAbort = () => {
      cleanup()
      resolve('aborted')
    }

    const wake = () => {
      cleanup()
      resolve('wake')
    }

    const cleanup = () => {
      window.clearInterval(countdownTimer)
      window.clearTimeout(timeoutTimer)
      signal.removeEventListener('abort', onAbort)
    }

    registerWake?.(wake)

    const countdownTimer = window.setInterval(() => {
      remainingMs = Math.max(0, remainingMs - countdownTickMs)
      onCountdown?.(remainingMs)
    }, countdownTickMs)

    const timeoutTimer = window.setTimeout(() => {
      cleanup()
      resolve('elapsed')
    }, delayMs)

    signal.addEventListener('abort', onAbort, { once: true })
  })
}
