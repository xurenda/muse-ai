import { describe, expect, it } from 'vitest'
import type { SessionTreeEntry } from '@earendil-works/pi-agent-core'
import { computeContextUsageFromBranchEntries } from '@/session-context-usage.js'

function assistantEntry(
  input: number,
  output: number,
  options?: { cacheRead?: number; cacheWrite?: number; stopReason?: 'stop' | 'aborted' },
): SessionTreeEntry {
  const cacheRead = options?.cacheRead ?? 0
  const cacheWrite = options?.cacheWrite ?? 0
  return {
    type: 'message',
    id: `msg-${input}-${output}-${cacheRead}`,
    parentId: null,
    timestamp: new Date().toISOString(),
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'hello' }],
      stopReason: options?.stopReason ?? 'stop',
      usage: { input, output, cacheRead, cacheWrite, totalTokens: input + output + cacheRead + cacheWrite },
    },
  } as SessionTreeEntry
}

function userEntry(text: string): SessionTreeEntry {
  return {
    type: 'message',
    id: `user-${text}`,
    parentId: null,
    timestamp: new Date().toISOString(),
    message: {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    },
  } as SessionTreeEntry
}

describe('computeContextUsageFromBranchEntries', () => {
  it('空分支且窗口已知时应为 0%', () => {
    const usage = computeContextUsageFromBranchEntries([], 200_000)
    expect(usage.tokens).toBe(0)
    expect(usage.contextWindow).toBe(200_000)
    expect(usage.percent).toBe(0)
  })

  it('窗口未知时 percent 应为 null', () => {
    const usage = computeContextUsageFromBranchEntries([], null)
    expect(usage.tokens).toBe(0)
    expect(usage.contextWindow).toBeNull()
    expect(usage.percent).toBeNull()
  })

  it('有 assistant usage 时应估算 tokens 与 percent', () => {
    const usage = computeContextUsageFromBranchEntries([userEntry('hi'), assistantEntry(1000, 200)], 10_000)
    expect(usage.tokens).toBe(1200)
    expect(usage.percent).toBe(12)
    expect(usage.usageTokens).toBe(1200)
    expect(usage.trailingTokens).toBe(0)
  })

  it('末轮含 cache 时应返回 lastTurnCacheHitRate', () => {
    const usage = computeContextUsageFromBranchEntries([userEntry('hi'), assistantEntry(100, 50, { cacheRead: 300 })], 10_000)
    expect(usage.lastTurnCacheHitRate).toBeCloseTo(75, 5)
  })

  it('compaction 后尚无新 assistant 时 tokens 应为 null', () => {
    const entries: SessionTreeEntry[] = [
      userEntry('a'),
      assistantEntry(500, 100),
      {
        type: 'compaction',
        id: 'compact-1',
        parentId: null,
        timestamp: new Date().toISOString(),
        summary: 'summary',
        firstKeptEntryId: 'keep',
        tokensBefore: 600,
      } as SessionTreeEntry,
    ]
    const usage = computeContextUsageFromBranchEntries(entries, 128_000)
    expect(usage.tokens).toBeNull()
    expect(usage.percent).toBeNull()
    expect(usage.contextWindow).toBe(128_000)
  })
})
