import { describe, expect, it } from 'vitest'
import { mergeBranchWithEphemeralTail } from '@/lib/merge-branch-messages'
import { createAssistantMessage, createUserMessage } from '@/lib/chat-types'

describe('mergeBranchWithEphemeralTail', () => {
  it('流式进行中应保留 SSE 尾部 assistant', () => {
    const current = [createUserMessage('你好', 'prompt'), { ...createAssistantMessage(), text: '正在', streaming: true }]
    const merged = mergeBranchWithEphemeralTail(current, [{ id: 'u1', role: 'user', text: '你好' }])
    expect(merged).toHaveLength(2)
    if (merged.at(-1)?.role === 'assistant') {
      expect(merged.at(-1)?.text).toBe('正在')
    }
  })

  it('分支已有 assistant 时应以分支为准', () => {
    const current = [createUserMessage('你好', 'prompt'), { ...createAssistantMessage(), text: 'SSE', streaming: false }]
    const merged = mergeBranchWithEphemeralTail(current, [
      { id: 'u1', role: 'user', text: '你好' },
      { id: 'a1', role: 'assistant', text: '持久化回复' },
    ])
    expect(merged).toHaveLength(2)
    if (merged.at(-1)?.role === 'assistant') {
      expect(merged.at(-1)?.text).toBe('持久化回复')
    }
  })

  it('分支 assistant 带 error 时应直接展示，无需 merge', () => {
    const current = [createUserMessage('你是谁', 'prompt')]
    const merged = mergeBranchWithEphemeralTail(current, [
      { id: 'u1', role: 'user', text: '你是谁' },
      { id: 'a1', role: 'assistant', text: '', error: '未配置 LLM Provider' },
    ])
    expect(merged).toHaveLength(2)
    if (merged.at(-1)?.role === 'assistant') {
      expect(merged.at(-1)?.error).toContain('未配置 LLM Provider')
    }
  })
})
