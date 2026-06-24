import { describe, expect, it } from 'vitest'
import { extractUserQuestions, truncateQuestionPreview, getChatMessageAnchorId } from '@/lib/chat-question-nav'
import type { ChatMessage } from '@/lib/chat-types'

describe('truncateQuestionPreview', () => {
  it('合并空白并截断过长文案', () => {
    expect(truncateQuestionPreview('  hello   world  ', 8)).toBe('hello wo…')
  })

  it('短文案不截断', () => {
    expect(truncateQuestionPreview('你好')).toBe('你好')
  })
})

describe('extractUserQuestions', () => {
  it('仅提取用户消息并生成序号与摘要', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: '第一个问题', mode: 'prompt' },
      { id: 'a1', role: 'assistant', blocks: [], streaming: false },
      { id: 'u2', role: 'user', content: '第二个问题', mode: 'prompt' },
    ]

    expect(extractUserQuestions(messages)).toEqual([
      { id: 'u1', index: 1, preview: '第一个问题' },
      { id: 'u2', index: 2, preview: '第二个问题' },
    ])
  })
})

describe('getChatMessageAnchorId', () => {
  it('生成稳定锚点 id', () => {
    expect(getChatMessageAnchorId('abc')).toBe('chat-message-abc')
  })
})
