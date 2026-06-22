import { describe, expect, it } from 'vitest'
import {
  CLI_API_PATHS,
  DEFAULT_PORTS,
  SERVER_API_PATHS,
  deviceCredentialsPath,
  deviceEventsPath,
  sessionAbortPath,
  sessionEventsPath,
} from '@/constants/api-paths.js'
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

  it('sessionAbortPath 应生成 abort 路径', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(sessionAbortPath(id)).toBe(`/sessions/${id}/abort`)
    expect(CLI_API_PATHS.SESSION_ABORT).toBe('/sessions/:sessionId/abort')
  })

  it('deviceCredentialsPath 应生成设备凭证路径', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(deviceCredentialsPath(id)).toBe(`/devices/${id}/credentials`)
  })

  it('deviceEventsPath 应生成设备级 SSE 路径', () => {
    expect(deviceEventsPath()).toBe('/device/events')
    expect(CLI_API_PATHS.DEVICE_EVENTS).toBe('/device/events')
  })

  it('默认端口应符合架构约定', () => {
    expect(DEFAULT_PORTS.SERVER).toBe(65435)
    expect(DEFAULT_PORTS.CLI).toBe(65433)
    expect(DEFAULT_PORTS.WEB_DEV).toBe(65434)
  })

  it('应包含 model-strategy 路径', () => {
    expect(SERVER_API_PATHS.SETTINGS_MODEL_STRATEGY).toBe('/settings/model-strategy')
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

  it('museSseEventSchema 应支持 thinking_delta', () => {
    const parsed = museSseEventSchema.safeParse({ type: 'thinking_delta', delta: '…' })
    expect(parsed.success).toBe(true)
  })

  it('museSseEventSchema 应支持 session_meta_updated', () => {
    const parsed = museSseEventSchema.safeParse({
      type: 'session_meta_updated',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Todo App 规划',
      nameSource: 'auto_llm',
      updatedAt: '2026-06-16T00:00:00.000Z',
    })
    expect(parsed.success).toBe(true)
  })

  it('museSseEventSchema 应支持 model_resolved', () => {
    const parsed = museSseEventSchema.safeParse({
      type: 'model_resolved',
      modelRef: 'openai/gpt-4o-mini',
      task: 'chat',
      usedFallback: true,
    })
    expect(parsed.success).toBe(true)
  })

  it('museSseEventSchema 应支持 compaction 事件', () => {
    expect(museSseEventSchema.safeParse({ type: 'compaction_start', reason: 'manual' }).success).toBe(true)
    expect(
      museSseEventSchema.safeParse({
        type: 'compaction_end',
        reason: 'overflow',
        success: true,
        tokensBefore: 120_000,
        compactionCount: 2,
      }).success,
    ).toBe(true)
    expect(
      museSseEventSchema.safeParse({
        type: 'compaction_end',
        reason: 'manual',
        success: false,
        cancelled: true,
      }).success,
    ).toBe(true)
  })

  it('museSseEventSchema 应支持带 usage 的 turn_end', () => {
    const parsed = museSseEventSchema.safeParse({
      type: 'turn_end',
      usage: { input: 100, output: 50, total: 150, costTotal: 0.01 },
    })
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
