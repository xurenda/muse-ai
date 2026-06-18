import { describe, expect, it } from 'vitest'
import { finalizeOpenThinkingBlock, getAssistantThinking, getAssistantText } from '@/lib/assistant-message-helpers'
import { applySseEvent } from '@/lib/chat-reducer'
import { createUserMessage } from '@/lib/chat-types'

describe('applySseEvent', () => {
  it('应分别累积 text_delta 与 thinking_delta 到 blocks', () => {
    let messages = [createUserMessage('hi', 'prompt')]
    messages = applySseEvent(messages, { type: 'agent_start' })
    messages = applySseEvent(messages, { type: 'thinking_delta', delta: '想' })
    messages = applySseEvent(messages, { type: 'text_delta', delta: '你好' })
    const assistant = messages.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant') {
      expect(getAssistantThinking(assistant)).toBe('想')
      expect(getAssistantText(assistant)).toBe('你好')
      expect(assistant.blocks[0]?.type).toBe('thinking')
      expect(assistant.blocks[0]?.type === 'thinking' ? assistant.blocks[0].durationMs : undefined).toBeTypeOf('number')
    }
  })

  it('tool_start 应收尾 thinking 并写入 durationMs', () => {
    let messages = applySseEvent([], { type: 'agent_start' })
    messages = applySseEvent(messages, { type: 'thinking_delta', delta: '想' })
    messages = applySseEvent(messages, {
      type: 'tool_start',
      toolCallId: 'tc1',
      toolName: 'ls',
      args: {},
    })
    const assistant = messages.at(-1)
    if (assistant?.role === 'assistant') {
      const thinking = assistant.blocks[0]
      expect(thinking?.type).toBe('thinking')
      if (thinking?.type === 'thinking') {
        expect(thinking.durationMs).toBeTypeOf('number')
        expect(thinking.startedAt).toBeUndefined()
      }
    }
  })

  it('应按 SSE 顺序交错 text 与 tool 块', () => {
    let messages = applySseEvent([], { type: 'agent_start' })
    messages = applySseEvent(messages, { type: 'text_delta', delta: '先看目录' })
    messages = applySseEvent(messages, {
      type: 'tool_start',
      toolCallId: 'tc1',
      toolName: 'ls',
      args: { path: '.' },
    })
    messages = applySseEvent(messages, {
      type: 'tool_end',
      toolCallId: 'tc1',
      toolName: 'ls',
      result: 'README.md',
    })
    messages = applySseEvent(messages, { type: 'text_delta', delta: '找到 README.md' })

    const assistant = messages.at(-1)
    if (assistant?.role === 'assistant') {
      expect(assistant.blocks).toHaveLength(3)
      expect(getAssistantText(assistant)).toBe('先看目录找到 README.md')
    }
  })

  it('thinking 应切开相邻 tool 组', () => {
    let messages = applySseEvent([], { type: 'agent_start' })
    messages = applySseEvent(messages, { type: 'thinking_delta', delta: '先想一' })
    messages = applySseEvent(messages, {
      type: 'tool_start',
      toolCallId: 'tc1',
      toolName: 'ls',
      args: {},
    })
    messages = applySseEvent(messages, {
      type: 'tool_end',
      toolCallId: 'tc1',
      toolName: 'ls',
      result: 'ok',
    })
    messages = applySseEvent(messages, { type: 'thinking_delta', delta: '再想二' })
    messages = applySseEvent(messages, {
      type: 'tool_start',
      toolCallId: 'tc2',
      toolName: 'read',
      args: {},
    })

    const assistant = messages.at(-1)
    if (assistant?.role === 'assistant') {
      expect(assistant.blocks.filter(block => block.type === 'tools')).toHaveLength(2)
      expect(assistant.blocks.filter(block => block.type === 'thinking')).toHaveLength(2)
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

describe('finalizeOpenThinkingBlock', () => {
  it('应为未闭合 thinking 写入 durationMs', () => {
    const blocks = finalizeOpenThinkingBlock([{ type: 'thinking', thinking: 'a', startedAt: Date.now() - 2500 }])
    expect(blocks[0]?.type).toBe('thinking')
    if (blocks[0]?.type === 'thinking') {
      expect(blocks[0].durationMs).toBeGreaterThanOrEqual(2000)
    }
  })
})
