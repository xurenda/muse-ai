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
})
