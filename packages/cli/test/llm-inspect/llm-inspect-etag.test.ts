import { describe, expect, it } from 'vitest'
import { computeSessionLlmInspectETag, matchesIfNoneMatch } from '@/llm-inspect/llm-inspect-etag.js'

describe('llm-inspect-etag', () => {
  it('相同快照生成相同 ETag', () => {
    const response = {
      sessionId: 'session-1',
      updatedAt: '2026-06-11T00:00:00.000Z',
      request: {
        task: 'chat' as const,
        payload: { model: 'proxy' },
        capturedAt: '2026-06-11T00:00:00.000Z',
      },
      response: {
        status: 200,
        message: { content: [{ type: 'text', text: 'hi' }] },
        capturedAt: '2026-06-11T00:00:01.000Z',
      },
    }

    expect(computeSessionLlmInspectETag(response)).toBe(computeSessionLlmInspectETag(response))
  })

  it('response status 变化时 ETag 变化', () => {
    const base = {
      sessionId: 'session-1',
      updatedAt: '2026-06-11T00:00:00.000Z',
      response: {
        status: 200,
        message: { content: [] },
        capturedAt: '2026-06-11T00:00:01.000Z',
      },
    }
    const changed = {
      sessionId: 'session-1',
      updatedAt: '2026-06-11T00:00:02.000Z',
      response: {
        status: 500,
        message: { content: [] },
        capturedAt: '2026-06-11T00:00:02.000Z',
      },
    }

    expect(computeSessionLlmInspectETag(base)).not.toBe(computeSessionLlmInspectETag(changed))
  })

  it('matchesIfNoneMatch 支持带引号与逗号分隔', () => {
    const etag = '"abc123"'

    expect(matchesIfNoneMatch('"abc123"', etag)).toBe(true)
    expect(matchesIfNoneMatch('W/"abc123", "other"', etag)).toBe(true)
    expect(matchesIfNoneMatch('"different"', etag)).toBe(false)
  })
})
