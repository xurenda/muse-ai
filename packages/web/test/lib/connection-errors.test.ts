import { describe, expect, it } from 'vitest'
import { CliApiError } from '@/api/cli-client'
import { formatConnectionErrorMessage, parseConnectionError } from '@/lib/connection-errors'

describe('parseConnectionError', () => {
  it('应识别 cli_unreachable', () => {
    expect(parseConnectionError(new Error('cli_unreachable'))).toEqual({ code: 'cli_unreachable' })
  })

  it('应识别 SSE 订阅失败', () => {
    expect(parseConnectionError(new CliApiError(503, 'sse_subscribe_failed', '订阅 SSE 失败 (503)'))).toEqual({
      code: 'sse_subscribe_failed',
      detail: '503',
    })
  })

  it('应将其他 CliApiError 归为 unknown', () => {
    const parsed = parseConnectionError(new CliApiError(404, 'session_not_found', 'Session 不存在'))
    expect(parsed.code).toBe('unknown')
    expect(parsed.detail).toContain('Session')
  })
})

describe('formatConnectionErrorMessage', () => {
  const t = (key: string, options?: Record<string, unknown>) => {
    if (key === 'errorSseSubscribeFailed') return `SSE 失败 ${options?.status}`
    if (key === 'errorConnectionUnknown') return `未知: ${options?.message}`
    return key
  }

  it('应格式化 SSE 错误', () => {
    expect(formatConnectionErrorMessage({ code: 'sse_subscribe_failed', detail: '502' }, t)).toBe('SSE 失败 502')
  })
})
