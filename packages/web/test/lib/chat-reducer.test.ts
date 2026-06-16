import { describe, expect, it } from 'vitest'
import { applySseEvent } from '@/lib/chat-reducer'
import { createUserMessage } from '@/lib/chat-types'

describe('applySseEvent', () => {
  it('应分别累积 text_delta 与 thinking_delta', () => {
    let messages = [createUserMessage('hi', 'prompt')]
    messages = applySseEvent(messages, { type: 'agent_start' })
    messages = applySseEvent(messages, { type: 'thinking_delta', delta: '想' })
    messages = applySseEvent(messages, { type: 'text_delta', delta: '你好' })
    const assistant = messages.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant') {
      expect(assistant.thinking).toBe('想')
      expect(assistant.text).toBe('你好')
    }
  })

  it('应更新 tool_start / tool_end', () => {
    let messages = applySseEvent([], { type: 'agent_start' })
    messages = applySseEvent(messages, {
      type: 'tool_start',
      toolCallId: 'tc1',
      toolName: 'read',
      args: { path: 'a.ts' },
    })
    messages = applySseEvent(messages, {
      type: 'tool_end',
      toolCallId: 'tc1',
      toolName: 'read',
      result: 'content',
    })
    const assistant = messages.at(-1)
    if (assistant?.role === 'assistant') {
      expect(assistant.toolCalls).toHaveLength(1)
      expect(assistant.toolCalls[0]?.status).toBe('done')
      expect(assistant.toolCalls[0]?.result).toBe('content')
    }
  })

  it('error 事件应写入 assistant.error', () => {
    let messages = applySseEvent([], { type: 'agent_start' })
    messages = applySseEvent(messages, { type: 'error', message: 'LLM 请求失败' })
    const assistant = messages.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant') {
      expect(assistant.error).toBe('LLM 请求失败')
      expect(assistant.streaming).toBe(false)
    }
  })
})
