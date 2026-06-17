import { describe, expect, it } from 'vitest'
import { extractBranchMessageError, formatLlmErrorMessage } from '@/assistant-turn-error.js'
import { mapBranchMessages } from '@/session-tree.js'

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
