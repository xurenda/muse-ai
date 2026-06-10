import { describe, expect, it } from 'vitest'
import { applyAgentEventToView } from '@/utils/chat-view/apply-agent-event'
import { createInitialChatViewState } from '@/utils/chat-view/types'

const T0 = 1_000

describe('applyAgentEventToView', () => {
  it('流式中间轮：思考展开，结束后折叠', () => {
    let state = createInitialChatViewState()

    state = applyAgentEventToView(
      state,
      {
        type: 'message_start',
        message: {
          role: 'assistant',
          stopReason: 'toolUse',
          content: [{ type: 'text', text: '让我来探索' }],
          timestamp: T0,
        },
      },
      T0,
    )

    const thinking = state.items.find((item) => item.kind === 'thinking')
    expect(thinking).toMatchObject({ status: 'active', expanded: true, content: '让我来探索' })

    state = applyAgentEventToView(
      state,
      {
        type: 'message_end',
        message: {
          role: 'assistant',
          stopReason: 'toolUse',
          content: [{ type: 'text', text: '让我来探索一下仓库。' }],
          timestamp: T0,
        },
      },
      T0 + 800,
    )

    const doneThinking = state.items.find((item) => item.kind === 'thinking')
    expect(doneThinking).toMatchObject({
      status: 'done',
      expanded: false,
      content: '让我来探索一下仓库。',
      endedAt: T0 + 800,
    })
  })

  it('探索开始后中间思考归入工具组', () => {
    let state = createInitialChatViewState()

    state = applyAgentEventToView(
      state,
      {
        type: 'tool_execution_start',
        toolCallId: 'tc-1',
        toolName: 'ls',
        args: {},
      },
      T0,
    )

    state = applyAgentEventToView(
      state,
      {
        type: 'message_start',
        message: {
          role: 'assistant',
          stopReason: 'toolUse',
          content: [{ type: 'text', text: '继续读取文件' }],
          timestamp: T0 + 100,
        },
      },
      T0 + 100,
    )

    const group = state.items.find((item) => item.kind === 'tool-group')
    expect(group?.kind).toBe('tool-group')
    if (group?.kind !== 'tool-group') {
      throw new Error('expected tool-group')
    }
    expect(group.entries.some((entry) => entry.kind === 'thinking' && entry.content === '继续读取文件')).toBe(true)
    expect(state.items.some((item) => item.kind === 'thinking')).toBe(false)
  })

  it('turn_end 不拆分工具组', () => {
    let state = createInitialChatViewState()

    state = applyAgentEventToView(
      state,
      {
        type: 'tool_execution_start',
        toolCallId: 'tc-1',
        toolName: 'ls',
        args: {},
      },
      T0,
    )

    state = applyAgentEventToView(state, { type: 'turn_end', message: {}, toolResults: [] }, T0 + 600)

    expect(state.activeToolGroupId).toBeTruthy()
    const group = state.items.find((item) => item.kind === 'tool-group')
    expect(group).toMatchObject({ status: 'active', expanded: true })
  })

  it('最终回答单独成 answer 块并结束探索', () => {
    let state = createInitialChatViewState()

    state = applyAgentEventToView(
      state,
      {
        type: 'tool_execution_start',
        toolCallId: 'tc-1',
        toolName: 'ls',
        args: {},
      },
      T0,
    )

    state = applyAgentEventToView(
      state,
      {
        type: 'message_start',
        message: {
          role: 'assistant',
          stopReason: 'stop',
          content: [],
          timestamp: T0,
        },
      },
      T0,
    )

    state = applyAgentEventToView(
      state,
      {
        type: 'message_update',
        message: {
          role: 'assistant',
          stopReason: 'stop',
          content: [{ type: 'text', text: '这是答案' }],
          timestamp: T0,
        },
        assistantMessageEvent: { type: 'text_delta', delta: '这是答案', contentIndex: 0, partial: {} },
      },
      T0 + 100,
    )

    state = applyAgentEventToView(
      state,
      {
        type: 'message_end',
        message: {
          role: 'assistant',
          stopReason: 'stop',
          content: [{ type: 'text', text: '这是答案。' }],
          timestamp: T0,
        },
      },
      T0 + 200,
    )

    const answer = state.items.find((item) => item.kind === 'answer')
    expect(answer).toMatchObject({ content: '这是答案。', streaming: false })
    expect(state.activeToolGroupId).toBeUndefined()
    const group = state.items.find((item) => item.kind === 'tool-group')
    expect(group).toMatchObject({ status: 'done', expanded: false })
  })
})
