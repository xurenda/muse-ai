import { describe, expect, it } from 'vitest'
import { finalizeOpenThinkingBlock, getAssistantThinking, getAssistantText } from '@/lib/assistant-message-helpers'
import { applySseEvent, finalizeStoppedAssistantTail } from '@/lib/chat-reducer'
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

  it('agent_end 应收尾 running tool', () => {
    let messages = applySseEvent([], { type: 'agent_start' })
    messages = applySseEvent(messages, {
      type: 'tool_start',
      toolCallId: 'tc1',
      toolName: 'bash',
      args: { command: 'sleep 10' },
    })
    messages = applySseEvent(messages, { type: 'agent_end' }, { stoppedToolMessage: '已停止' })
    const assistant = messages.at(-1)
    expect(assistant?.role).toBe('assistant')
    if (assistant?.role === 'assistant') {
      expect(assistant.streaming).toBe(false)
      const tools = assistant.blocks.find(block => block.type === 'tools')
      expect(tools?.type).toBe('tools')
      if (tools?.type === 'tools') {
        expect(tools.tools[0]?.status).toBe('done')
        expect(tools.tools[0]?.isError).toBe(true)
        expect(tools.tools[0]?.result).toBe('已停止')
      }
    }
  })

  it('agent_end 无 usage 时不应覆盖停止时已写入的 turnUsage 与 durationMs', () => {
    let messages = applySseEvent([], { type: 'agent_start' })
    messages = applySseEvent(messages, { type: 'text_delta', delta: '部分内容' })
    messages = finalizeStoppedAssistantTail(messages, '已停止', {
      turnUsage: { input: 100, output: 200, total: 300 },
      durationMs: 12_000,
    })
    messages = applySseEvent(messages, { type: 'agent_end', durationMs: 12_500 })
    const assistant = messages.at(-1)
    if (assistant?.role === 'assistant') {
      expect(assistant.turnUsage?.total).toBe(300)
      expect(assistant.durationMs).toBe(12_500)
    }
  })

  it('finalizeStoppedAssistantTail 应写入 turnUsage 与 durationMs', () => {
    let messages = applySseEvent([], { type: 'agent_start' })
    messages = applySseEvent(messages, { type: 'text_delta', delta: 'hello' })
    messages = finalizeStoppedAssistantTail(messages, '已停止', {
      turnUsage: { input: 10, output: 20, total: 30 },
      durationMs: 5_000,
    })
    const assistant = messages.at(-1)
    if (assistant?.role === 'assistant') {
      expect(assistant.streaming).toBe(false)
      expect(assistant.turnUsage?.total).toBe(30)
      expect(assistant.durationMs).toBe(5_000)
      expect(assistant.timestamp).toBeTypeOf('string')
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
