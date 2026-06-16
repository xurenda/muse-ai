import { describe, expect, it } from 'vitest'
import { mapHarnessEventToSse } from '@/harness-events.js'

describe('mapHarnessEventToSse', () => {
  it('应将 text_delta 与 thinking_delta 分别映射', () => {
    const text = mapHarnessEventToSse({
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', delta: '你好' },
    })
    expect(text).toEqual({ type: 'text_delta', delta: '你好' })

    const thinking = mapHarnessEventToSse({
      type: 'message_update',
      assistantMessageEvent: { type: 'thinking_delta', delta: '推理中…' },
    })
    expect(thinking).toEqual({ type: 'thinking_delta', delta: '推理中…' })
  })

  it('应映射 tool 事件', () => {
    const start = mapHarnessEventToSse({
      type: 'tool_execution_start',
      toolCallId: 'tc1',
      toolName: 'read',
      args: { path: 'a.ts' },
    })
    expect(start).toEqual({
      type: 'tool_start',
      toolCallId: 'tc1',
      toolName: 'read',
      args: { path: 'a.ts' },
    })
  })
})
