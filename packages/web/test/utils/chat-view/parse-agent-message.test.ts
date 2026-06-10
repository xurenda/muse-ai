import { describe, expect, it } from 'vitest'
import {
  buildProcessContent,
  isIntermediateAssistant,
  parseAssistantMessage,
} from '@/utils/chat-view/parse-agent-message'

describe('parseAssistantMessage', () => {
  it('解析 thinking、text 与 toolCall', () => {
    const parsed = parseAssistantMessage({
      role: 'assistant',
      stopReason: 'toolUse',
      content: [
        { type: 'thinking', thinking: '内部推理' },
        { type: 'text', text: '让我来探索一下' },
        { type: 'toolCall', id: 'tc-1', name: 'ls', arguments: { path: '.' } },
      ],
      timestamp: 1000,
    })

    expect(parsed).toEqual({
      thinking: '内部推理',
      text: '让我来探索一下',
      toolCalls: [{ id: 'tc-1', name: 'ls', arguments: { path: '.' } }],
      stopReason: 'toolUse',
      timestamp: 1000,
    })
  })

  it('中间轮判定', () => {
    expect(isIntermediateAssistant({ toolCalls: [{ id: '1', name: 'ls', arguments: {} }], stopReason: 'stop' })).toBe(
      true,
    )
    expect(isIntermediateAssistant({ toolCalls: [], stopReason: 'toolUse' })).toBe(true)
    expect(isIntermediateAssistant({ toolCalls: [], stopReason: 'stop' })).toBe(false)
  })

  it('中间轮过程说明合并 thinking 与 text', () => {
    expect(
      buildProcessContent({
        thinking: '推理',
        text: '先读文件',
      }),
    ).toBe('推理\n先读文件')
  })
})
