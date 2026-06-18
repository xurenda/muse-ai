import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeSseBackoffMs, waitForSseRetry } from '@/lib/sse-reconnect'

beforeEach(() => {
  vi.stubGlobal('window', globalThis)
})

describe('computeSseBackoffMs', () => {
  it('应按指数退避并封顶 30s', () => {
    expect(computeSseBackoffMs(0)).toBe(0)
    expect(computeSseBackoffMs(1)).toBe(1_000)
    expect(computeSseBackoffMs(2)).toBe(2_000)
    expect(computeSseBackoffMs(3)).toBe(4_000)
    expect(computeSseBackoffMs(6)).toBe(30_000)
    expect(computeSseBackoffMs(10)).toBe(30_000)
  })
})

describe('waitForSseRetry', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('abort 后应返回 aborted', async () => {
    const abort = new AbortController()
    abort.abort()
    await expect(waitForSseRetry({ delayMs: 1_000, signal: abort.signal })).resolves.toBe('aborted')
  })

  it('wake 后应返回 wake', async () => {
    vi.useFakeTimers()
    const abort = new AbortController()
    let wake: (() => void) | undefined

    const promise = waitForSseRetry({
      delayMs: 5_000,
      signal: abort.signal,
      registerWake: fn => {
        wake = fn
      },
    })

    wake?.()
    await expect(promise).resolves.toBe('wake')
  })

  it('倒计时结束应返回 elapsed', async () => {
    vi.useFakeTimers()
    const abort = new AbortController()
    const countdown: number[] = []

    const promise = waitForSseRetry({
      delayMs: 1_000,
      signal: abort.signal,
      onCountdown: ms => countdown.push(ms),
      countdownTickMs: 500,
    })

    await vi.advanceTimersByTimeAsync(1_000)
    await expect(promise).resolves.toBe('elapsed')
    expect(countdown.length).toBeGreaterThan(0)
  })
})
