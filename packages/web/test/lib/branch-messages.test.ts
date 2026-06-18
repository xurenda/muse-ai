import { describe, expect, it } from 'vitest'
import { getAssistantText, getAssistantThinking, getAssistantToolCalls } from '@/lib/assistant-message-helpers'
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

  it('应将分支 thinking 与 toolCalls 映射到 blocks', () => {
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
      expect(getAssistantThinking(messages[0])).toBe('分析中')
      expect(getAssistantToolCalls(messages[0])).toHaveLength(1)
    }
  })

  it('应保留 blocks 中的 thinking durationMs', () => {
    const messages = branchMessagesToChat([
      {
        id: 'a1',
        role: 'assistant',
        text: '完成',
        blocks: [
          { type: 'thinking', thinking: '分析', durationMs: 2500 },
          { type: 'text', text: '完成' },
        ],
      },
    ])
    if (messages[0]?.role === 'assistant') {
      const thinking = messages[0].blocks[0]
      expect(thinking?.type).toBe('thinking')
      if (thinking?.type === 'thinking') {
        expect(thinking.durationMs).toBe(2500)
      }
    }
  })

  it('应优先使用 blocks 还原交错顺序', () => {
    const messages = branchMessagesToChat([
      {
        id: 'a1',
        role: 'assistant',
        text: '最终',
        blocks: [
          { type: 'thinking', thinking: '分析', durationMs: 1200 },
          { type: 'text', text: '先看' },
          {
            type: 'tools',
            tools: [{ toolCallId: 'tc1', toolName: 'ls', args: {}, result: 'ok' }],
          },
          { type: 'text', text: '最终' },
        ],
      },
    ])
    if (messages[0]?.role === 'assistant') {
      expect(messages[0].blocks[0]).toEqual({ type: 'thinking', thinking: '分析', durationMs: 1200 })
      expect(getAssistantText(messages[0])).toBe('先看最终')
    }
  })
})
