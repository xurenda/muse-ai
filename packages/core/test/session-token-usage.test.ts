import { describe, expect, it } from 'vitest'
import { mapHarnessEventToSse } from '@/harness-events.js'
import { aggregateSessionTokenUsage, extractTurnUsageFromMessage, normalizeTurnTokenUsage } from '@/session-token-usage.js'

describe('session-token-usage', () => {
  it('应规范化 pi Usage 字段', () => {
    expect(
      normalizeTurnTokenUsage({
        input: 100,
        output: 50,
        cacheRead: 10,
        cacheWrite: 5,
        totalTokens: 165,
        cost: { total: 0.012 },
      }),
    ).toEqual({
      input: 100,
      output: 50,
      cacheRead: 10,
      cacheWrite: 5,
      total: 165,
      costTotal: 0.012,
    })
  })

  it('应从 assistant message 提取用量', () => {
    const usage = extractTurnUsageFromMessage({
      role: 'assistant',
      content: [{ type: 'text', text: 'hi' }],
      api: 'openai',
      provider: 'openai',
      model: 'gpt-4',
      usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, total: 15, cost: { total: 0 } },
      stopReason: 'stop',
      timestamp: Date.now(),
    })
    expect(usage?.total).toBe(15)
  })

  it('应汇总 Session 中全部 assistant 消息', () => {
    const usage = aggregateSessionTokenUsage([
      {
        type: 'message',
        id: 'm1',
        parentId: null,
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'a' }],
          api: 'openai',
          provider: 'openai',
          model: 'gpt-4',
          usage: { input: 100, output: 20, cacheRead: 0, cacheWrite: 0, total: 120, cost: { total: 0.01 } },
          stopReason: 'stop',
          timestamp: 1,
        },
      },
      {
        type: 'message',
        id: 'm2',
        parentId: 'm1',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: 'b' }],
          api: 'openai',
          provider: 'openai',
          model: 'gpt-4',
          usage: { input: 50, output: 10, cacheRead: 5, cacheWrite: 0, total: 65, cost: { total: 0.002 } },
          stopReason: 'stop',
          timestamp: 2,
        },
      },
    ])
    expect(usage).toEqual({
      input: 150,
      output: 30,
      cacheRead: 5,
      cacheWrite: 0,
      total: 185,
      costTotal: 0.012,
      turnCount: 2,
    })
  })
})

describe('mapHarnessEventToSse turn_end', () => {
  it('应携带 assistant turn 的 usage', () => {
    const mapped = mapHarnessEventToSse({
      type: 'turn_end',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'done' }],
        api: 'openai',
        provider: 'openai',
        model: 'gpt-4',
        usage: { input: 12, output: 8, cacheRead: 0, cacheWrite: 0, total: 20, cost: { total: 0 } },
        stopReason: 'stop',
        timestamp: Date.now(),
      },
      toolResults: [],
    })
    expect(mapped).toEqual({
      type: 'turn_end',
      usage: { input: 12, output: 8, total: 20 },
    })
  })
})
