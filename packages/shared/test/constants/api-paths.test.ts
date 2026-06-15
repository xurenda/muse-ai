import { describe, expect, it } from 'vitest'
import { CLI_API_PATHS, DEFAULT_PORTS, SERVER_API_PATHS, sessionEventsPath } from '@/constants/api-paths.js'
import { createHealthResponse } from '@/types/health.js'
import { formatSseData, museSseEventSchema } from '@/types/sse-events.js'
import { deviceSchema } from '@/types/device.js'

describe('api-paths', () => {
  it('应包含 server 与 cli 的 health 路径', () => {
    expect(SERVER_API_PATHS.HEALTH).toBe('/health')
    expect(CLI_API_PATHS.HEALTH).toBe('/health')
  })

  it('sessionEventsPath 应生成按 session 的 SSE 路径', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(sessionEventsPath(id)).toBe(`/sessions/${id}/events`)
    expect(CLI_API_PATHS.SESSION_EVENTS).toBe('/sessions/:sessionId/events')
  })

  it('应包含设备配对初始化路径', () => {
    expect(SERVER_API_PATHS.DEVICES_PAIR_INIT).toBe('/devices/pair/init')
  })

  it('默认端口应符合架构约定', () => {
    expect(DEFAULT_PORTS.SERVER).toBe(3000)
    expect(DEFAULT_PORTS.CLI).toBe(7421)
  })
})

describe('health', () => {
  it('createHealthResponse 应返回 ok 与健康信息', () => {
    const body = createHealthResponse('server', '0.0.0')
    expect(body).toEqual({ ok: true, service: 'server', version: '0.0.0' })
  })
})

describe('sse-events', () => {
  it('formatSseData 应输出 SSE data 行', () => {
    const line = formatSseData({ type: 'text_delta', delta: 'hi' })
    expect(line).toBe('data: {"type":"text_delta","delta":"hi"}\n\n')
  })

  it('museSseEventSchema 应校验合法事件', () => {
    const parsed = museSseEventSchema.safeParse({ type: 'agent_end' })
    expect(parsed.success).toBe(true)
  })
})

describe('device', () => {
  it('deviceSchema 应拒绝无效 endpoint', () => {
    const parsed = deviceSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'macbook',
      endpoint: 'not-a-url',
      online: true,
    })
    expect(parsed.success).toBe(false)
  })
})
