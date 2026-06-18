import { describe, expect, it } from 'vitest'
import { countProcessRun, flattenProcessRunItems, groupAssistantBlocks, resolveProcessRunSummaryKey } from '@/lib/group-assistant-blocks'

describe('groupAssistantBlocks', () => {
  it('应将连续的 thinking / tools 合并为一段 process', () => {
    const segments = groupAssistantBlocks([
      { type: 'thinking', thinking: '想' },
      { type: 'tools', tools: [{ toolCallId: 't1', toolName: 'ls', args: {}, status: 'done' }] },
      { type: 'thinking', thinking: '再想' },
      { type: 'tools', tools: [{ toolCallId: 't2', toolName: 'read', args: {}, status: 'done' }] },
      { type: 'text', text: '完成' },
      { type: 'tools', tools: [{ toolCallId: 't3', toolName: 'grep', args: {}, status: 'done' }] },
    ])

    expect(segments).toHaveLength(3)
    expect(segments[0]?.type).toBe('process')
    expect(segments[1]).toEqual({ type: 'text', text: '完成' })
  })
})

describe('resolveProcessRunSummaryKey', () => {
  it('应按计数选择汇总 key', () => {
    expect(resolveProcessRunSummaryKey(2, 3)).toBe('both')
    expect(resolveProcessRunSummaryKey(0, 5)).toBe('toolsOnly')
    expect(resolveProcessRunSummaryKey(2, 0)).toBe('thinkingOnly')
    expect(resolveProcessRunSummaryKey(0, 0)).toBeNull()
  })
})

describe('countProcessRun / flattenProcessRunItems', () => {
  it('应统计全部 thinking 块与工具数', () => {
    const blocks = [
      { type: 'thinking' as const, thinking: 'a' },
      {
        type: 'tools' as const,
        tools: [
          { toolCallId: 't1', toolName: 'ls', args: {}, status: 'done' as const },
          { toolCallId: 't2', toolName: 'ls', args: {}, status: 'done' as const },
        ],
      },
      { type: 'thinking' as const, thinking: '' },
    ]

    expect(countProcessRun(blocks)).toEqual({ thinkingCount: 2, toolCount: 2 })
    expect(flattenProcessRunItems(blocks)).toHaveLength(4)
  })
})
