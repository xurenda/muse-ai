import { describe, expect, it } from 'vitest'
import { branchMessagesToChat } from '@/lib/branch-messages'

describe('branchMessagesToChat', () => {
  it('应将分支 error 映射到 assistant.error', () => {
    const messages = branchMessagesToChat([
      { id: 'u1', role: 'user', text: '你是谁' },
      { id: 'a1', role: 'assistant', text: '', error: '未配置 LLM Provider' },
    ])
    expect(messages).toHaveLength(2)
    if (messages.at(-1)?.role === 'assistant') {
      expect(messages.at(-1)?.error).toBe('未配置 LLM Provider')
    }
  })
})
