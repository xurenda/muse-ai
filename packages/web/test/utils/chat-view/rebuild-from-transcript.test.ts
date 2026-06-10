import { describe, expect, it } from 'vitest'
import { rebuildFromTranscript } from '@/utils/chat-view/rebuild-from-transcript'

describe('rebuildFromTranscript', () => {
  it('中间轮 text 归入 thinking，连续 toolResult 合并为一组', () => {
    const items = rebuildFromTranscript([
      { role: 'user', content: '当前仓库是干嘛的', timestamp: 1 },
      {
        role: 'assistant',
        stopReason: 'toolUse',
        content: [
          { type: 'text', text: '让我来探索一下这个仓库的结构和用途。' },
          { type: 'toolCall', id: 'tc-1', name: 'ls', arguments: {} },
          { type: 'toolCall', id: 'tc-2', name: 'read', arguments: {} },
        ],
        timestamp: 2,
      },
      {
        role: 'toolResult',
        toolCallId: 'tc-1',
        toolName: 'ls',
        content: [{ type: 'text', text: 'packages/' }],
        isError: false,
        timestamp: 3,
      },
      {
        role: 'toolResult',
        toolCallId: 'tc-2',
        toolName: 'read',
        content: [{ type: 'text', text: 'package.json' }],
        isError: false,
        timestamp: 4,
      },
      {
        role: 'assistant',
        stopReason: 'stop',
        content: [{ type: 'text', text: '这是一个 pnpm monorepo 项目。' }],
        timestamp: 5,
      },
    ])

    expect(items.map((item) => item.kind)).toEqual(['user', 'thinking', 'tool-group', 'answer'])
    expect(items[1]).toMatchObject({
      kind: 'thinking',
      content: '让我来探索一下这个仓库的结构和用途。',
      status: 'done',
      expanded: false,
    })
    expect(items[2]).toMatchObject({
      kind: 'tool-group',
      status: 'done',
      entries: [
        { kind: 'tool', toolName: 'ls', status: 'done' },
        { kind: 'tool', toolName: 'read', status: 'done' },
      ],
    })
    expect(items[3]).toMatchObject({
      kind: 'answer',
      content: '这是一个 pnpm monorepo 项目。',
    })
  })

  it('探索过程中的思考归入同一工具组', () => {
    const items = rebuildFromTranscript([
      { role: 'user', content: '分析仓库', timestamp: 1 },
      {
        role: 'assistant',
        stopReason: 'toolUse',
        content: [
          { type: 'text', text: '先看目录结构。' },
          { type: 'toolCall', id: 'tc-1', name: 'ls', arguments: {} },
        ],
        timestamp: 2,
      },
      {
        role: 'toolResult',
        toolCallId: 'tc-1',
        toolName: 'ls',
        content: [{ type: 'text', text: 'packages/' }],
        isError: false,
        timestamp: 3,
      },
      {
        role: 'assistant',
        stopReason: 'toolUse',
        content: [
          { type: 'text', text: '再读 package.json。' },
          { type: 'toolCall', id: 'tc-2', name: 'read', arguments: {} },
        ],
        timestamp: 4,
      },
      {
        role: 'toolResult',
        toolCallId: 'tc-2',
        toolName: 'read',
        content: [{ type: 'text', text: '{}' }],
        isError: false,
        timestamp: 5,
      },
      {
        role: 'assistant',
        stopReason: 'stop',
        content: [{ type: 'text', text: '完成。' }],
        timestamp: 6,
      },
    ])

    expect(items.map((item) => item.kind)).toEqual(['user', 'thinking', 'tool-group', 'answer'])
    const group = items[2]
    expect(group).toMatchObject({ kind: 'tool-group' })
    if (group?.kind !== 'tool-group') {
      throw new Error('expected tool-group')
    }
    expect(group.entries.map((entry) => entry.kind === 'tool' ? entry.toolName : 'thinking')).toEqual([
      'ls',
      'thinking',
      'read',
    ])
    expect(group.entries[1]).toMatchObject({
      kind: 'thinking',
      content: '再读 package.json。',
    })
  })

  it('不产生空 assistant 占位', () => {
    const items = rebuildFromTranscript([
      { role: 'user', content: 'hi', timestamp: 1 },
      {
        role: 'assistant',
        stopReason: 'toolUse',
        content: [{ type: 'toolCall', id: 'tc-1', name: 'ls', arguments: {} }],
        timestamp: 2,
      },
      {
        role: 'toolResult',
        toolCallId: 'tc-1',
        toolName: 'ls',
        content: [{ type: 'text', text: 'ok' }],
        isError: false,
        timestamp: 3,
      },
      {
        role: 'assistant',
        stopReason: 'stop',
        content: [{ type: 'text', text: '完成' }],
        timestamp: 4,
      },
    ])

    expect(items.some((item) => item.kind === 'thinking')).toBe(false)
    expect(items.map((item) => item.kind)).toEqual(['user', 'tool-group', 'answer'])
  })
})
