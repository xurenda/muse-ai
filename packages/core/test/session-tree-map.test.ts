import { describe, expect, it } from 'vitest'
import type { SessionTreeEntry } from '@earendil-works/pi-agent-core'
import { extractBranchMessageError, formatLlmErrorMessage } from '@/assistant-turn-error.js'
import { findTurnTipEntryId, getMessagePathToLeaf, mapBranchMessages, resolveNavigateTargetLeafId } from '@/session-tree.js'

function messageEntry(
  id: string,
  parentId: string | null,
  role: 'user' | 'assistant',
  timestamp: string,
  extra?: Partial<Extract<SessionTreeEntry, { type: 'message' }>['message']>,
): SessionTreeEntry {
  return {
    type: 'message',
    id,
    parentId,
    timestamp,
    message: {
      role,
      content: [{ type: 'text', text: role === 'user' ? '用户' : '回复' }],
      timestamp: Date.parse(timestamp),
      ...extra,
    },
  } as SessionTreeEntry
}

function toolResultEntry(id: string, parentId: string, toolCallId: string, timestamp: string): SessionTreeEntry {
  return {
    type: 'message',
    id,
    parentId,
    timestamp,
    message: {
      role: 'toolResult',
      toolCallId,
      toolName: 'ls',
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
      timestamp: Date.parse(timestamp),
    },
  } as SessionTreeEntry
}

describe('extractBranchMessageError', () => {
  it('应格式化 assistant 的 errorMessage', () => {
    const error = extractBranchMessageError({
      role: 'assistant',
      stopReason: 'error',
      errorMessage: '503 "no_provider"',
    })
    expect(error).toContain('未配置 LLM Provider')
  })
})

describe('mapBranchMessages', () => {
  it('应保留无正文但有 error 的 assistant', () => {
    const branch = mapBranchMessages([
      { role: 'user', content: '你是谁', timestamp: 1 },
      {
        role: 'assistant',
        content: [],
        stopReason: 'error',
        errorMessage: '503 "no_provider"',
        timestamp: 2,
      },
    ] as Parameters<typeof mapBranchMessages>[0])

    expect(branch).toHaveLength(2)
    expect(branch[1]?.role).toBe('assistant')
    expect(branch[1]?.text).toBe('')
    expect(branch[1]?.error).toBe(formatLlmErrorMessage('503 "no_provider"'))
  })

  it('仍应跳过既无正文也无 error 的 assistant', () => {
    const branch = mapBranchMessages([
      { role: 'user', content: '你好', timestamp: 1 },
      { role: 'assistant', content: [], stopReason: 'stop', timestamp: 2 },
    ] as Parameters<typeof mapBranchMessages>[0])

    expect(branch).toHaveLength(1)
    expect(branch[0]?.role).toBe('user')
  })

  it('应合并 assistant thinking 与 toolResult', () => {
    const branch = mapBranchMessages([
      { role: 'user', content: '查文件', timestamp: 1 },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '先看目录' },
          { type: 'toolCall', id: 'tc1', name: 'ls', arguments: { path: '.' } },
        ],
        stopReason: 'toolUse',
        timestamp: 2,
      },
      {
        role: 'toolResult',
        toolCallId: 'tc1',
        toolName: 'ls',
        content: [{ type: 'text', text: 'README.md' }],
        isError: false,
        timestamp: 3,
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: '找到 README.md' }],
        stopReason: 'stop',
        timestamp: 4,
      },
    ] as Parameters<typeof mapBranchMessages>[0])

    expect(branch).toHaveLength(2)
    expect(branch[1]?.role).toBe('assistant')
    expect(branch[1]?.thinking).toBe('先看目录')
    expect(branch[1]?.text).toBe('找到 README.md')
    expect(branch[1]?.toolCalls).toEqual([
      {
        toolCallId: 'tc1',
        toolName: 'ls',
        args: { path: '.' },
        result: 'README.md',
        isError: false,
      },
    ])
  })

  it('应将同一 user 轮次的多条 assistant 合并为一条', () => {
    const branch = mapBranchMessages([
      { role: 'user', content: '运行', timestamp: 1 },
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'tc1', name: 'bash', arguments: { command: 'pwd' } }],
        stopReason: 'toolUse',
        timestamp: 2,
      },
      {
        role: 'toolResult',
        toolCallId: 'tc1',
        toolName: 'bash',
        content: [{ type: 'text', text: '/tmp' }],
        isError: false,
        timestamp: 3,
      },
      {
        role: 'assistant',
        content: [{ type: 'text', text: '当前目录 /tmp' }],
        stopReason: 'stop',
        timestamp: 4,
      },
    ] as Parameters<typeof mapBranchMessages>[0])

    expect(branch).toHaveLength(2)
    expect(branch[1]?.toolCalls).toHaveLength(1)
    expect(branch[1]?.text).toBe('当前目录 /tmp')
  })
})

describe('findTurnTipEntryId', () => {
  it('应定位 tool loop 完成后的最终 assistant', () => {
    const entries: SessionTreeEntry[] = [
      messageEntry('u1', null, 'user', '2026-01-01T00:00:00.000Z'),
      messageEntry('a1', 'u1', 'assistant', '2026-01-01T00:00:01.000Z', { stopReason: 'toolUse', content: [] }),
      toolResultEntry('t1', 'a1', 'tc1', '2026-01-01T00:00:02.000Z'),
      messageEntry('a2', 't1', 'assistant', '2026-01-01T00:00:03.000Z', { stopReason: 'stop', content: [{ type: 'text', text: '完成' }] }),
    ]

    expect(findTurnTipEntryId(entries, 'u1')).toBe('a2')
  })

  it('存在中途 user 分叉时应优先完整 tool loop 路径', () => {
    const entries: SessionTreeEntry[] = [
      messageEntry('u1', null, 'user', '2026-01-01T00:00:00.000Z'),
      messageEntry('a1', 'u1', 'assistant', '2026-01-01T00:00:01.000Z', { stopReason: 'toolUse', content: [] }),
      toolResultEntry('t1', 'a1', 'tc1', '2026-01-01T00:00:02.000Z'),
      messageEntry('a2', 't1', 'assistant', '2026-01-01T00:00:03.000Z', { stopReason: 'stop', content: [{ type: 'text', text: '完整回答' }] }),
      messageEntry('u-fork', 'a1', 'user', '2026-01-01T00:00:04.000Z'),
      messageEntry('a-fork', 'u-fork', 'assistant', '2026-01-01T00:00:05.000Z', { stopReason: 'toolUse', content: [] }),
    ]

    expect(findTurnTipEntryId(entries, 'u1')).toBe('a2')
  })
})

describe('resolveNavigateTargetLeafId', () => {
  it('navigate 到首轮 assistant 时应落到 turn tip', () => {
    const entries: SessionTreeEntry[] = [
      messageEntry('u1', null, 'user', '2026-01-01T00:00:00.000Z'),
      messageEntry('a1', 'u1', 'assistant', '2026-01-01T00:00:01.000Z', { stopReason: 'toolUse', content: [] }),
      toolResultEntry('t1', 'a1', 'tc1', '2026-01-01T00:00:02.000Z'),
      messageEntry('a2', 't1', 'assistant', '2026-01-01T00:00:03.000Z', { stopReason: 'stop', content: [{ type: 'text', text: '完成' }] }),
    ]
    const a1 = entries[1] as Extract<SessionTreeEntry, { type: 'message' }>

    expect(resolveNavigateTargetLeafId(a1, entries, a1.id)).toBe('a2')
  })
})

describe('getMessagePathToLeaf', () => {
  it('应跨越 toolResult 收集 message 路径', () => {
    const entries: SessionTreeEntry[] = [
      messageEntry('u1', null, 'user', '2026-01-01T00:00:00.000Z'),
      messageEntry('a1', 'u1', 'assistant', '2026-01-01T00:00:01.000Z', { stopReason: 'toolUse', content: [] }),
      toolResultEntry('t1', 'a1', 'tc1', '2026-01-01T00:00:02.000Z'),
      messageEntry('a2', 't1', 'assistant', '2026-01-01T00:00:03.000Z', { stopReason: 'stop', content: [{ type: 'text', text: '完成' }] }),
    ]

    expect(getMessagePathToLeaf(entries, 'a2')).toEqual(['u1', 'a1', 'a2'])
  })
})
