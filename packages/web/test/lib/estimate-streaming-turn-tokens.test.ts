import { describe, expect, it } from 'vitest'
import {
  computeStreamingTurnTokenDisplay,
  estimateAssistantContentChars,
  estimateTokensFromChars,
  mergeTurnUsageWithContentEstimate,
} from '@/lib/estimate-streaming-turn-tokens'

describe('estimateStreamingTurnTokens', () => {
  it('应按 chars/4 估算 token', () => {
    expect(estimateTokensFromChars(0)).toBe(0)
    expect(estimateTokensFromChars(4)).toBe(1)
    expect(estimateTokensFromChars(5)).toBe(2)
  })

  it('应统计 thinking、text 与 tool 字符', () => {
    const chars = estimateAssistantContentChars([
      { type: 'thinking', thinking: 'abcd' },
      { type: 'text', text: 'efgh' },
      {
        type: 'tools',
        tools: [{ toolCallId: '1', toolName: 'read', args: { path: 'a.ts' }, status: 'done', result: 'ok' }],
      },
    ])
    expect(chars).toBeGreaterThan(8)
  })

  it('应在已确认用量上累加当前 turn 的估算增量', () => {
    expect(computeStreamingTurnTokenDisplay(4_000, 400, 0)).toBe(4_100)
    expect(computeStreamingTurnTokenDisplay(4_000, 1_200, 800)).toBe(4_100)
    expect(computeStreamingTurnTokenDisplay(4_000, 800, 800)).toBe(4_000)
  })

  it('mergeTurnUsageWithContentEstimate 应合并估算 total', () => {
    const merged = mergeTurnUsageWithContentEstimate({ input: 100, output: 3_900, total: 4_000 }, 1_200, 800)
    expect(merged?.total).toBe(4_100)
    expect(merged?.input).toBe(100)
  })
})
