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

  it('应将分支 thinking 与 toolCalls 映射到 ChatMessage', () => {
    const messages = branchMessagesToChat([
      {
        id: 'a1',
        role: 'assistant',
        text: '完成',
        thinking: '分析中',
        toolCalls: [{ toolCallId: 'tc1', toolName: 'read', args: { path: 'a.ts' }, result: 'ok' }],
      },
    ])
    expect(messages).toHaveLength(1)
    if (messages[0]?.role === 'assistant') {
      expect(messages[0].thinking).toBe('分析中')
      expect(messages[0].toolCalls).toHaveLength(1)
      expect(messages[0].toolCalls[0]?.status).toBe('done')
    }
  })
})
