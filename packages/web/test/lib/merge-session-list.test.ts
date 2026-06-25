import { describe, expect, it } from 'vitest'
import type { SessionMeta } from '@museai/shared'
import { mergeSessionList } from '@/lib/merge-session-list'

describe('mergeSessionList', () => {
  it('应将 SSE 补丁合并进已有 Session 列表', () => {
    const sessions: SessionMeta[] = [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        agentId: '00000000-0000-4000-8000-000000000001',
        name: '旧标题',
        nameSource: 'first_message',
        createdAt: '2026-06-16T00:00:00.000Z',
        updatedAt: '2026-06-16T00:00:00.000Z',
      },
    ]

    const merged = mergeSessionList(sessions, {
      '550e8400-e29b-41d4-a716-446655440000': {
        name: '新标题',
        nameSource: 'auto_llm',
        updatedAt: '2026-06-16T01:00:00.000Z',
      },
    })

    expect(merged[0]?.name).toBe('新标题')
    expect(merged[0]?.nameSource).toBe('auto_llm')
  })
})
