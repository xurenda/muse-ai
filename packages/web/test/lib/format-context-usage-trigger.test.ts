import { describe, expect, it } from 'vitest'
import { formatContextUsageTriggerParts, resolveContextUsageProgressPercent } from '@/lib/format-context-usage-trigger.js'

describe('formatContextUsageTriggerParts', () => {
  it('空 session 窗口已知时应返回 0 与窗口', () => {
    const parts = formatContextUsageTriggerParts({
      tokens: 0,
      contextWindow: 200_000,
      percent: 0,
    })
    expect(parts.percentText).toBe('0')
    expect(parts.windowText).toBe('200.0k')
    expect(parts.tokensPending).toBe(false)
    expect(resolveContextUsageProgressPercent(parts)).toBe(0)
  })

  it('窗口未知时 windowText 应为 —', () => {
    const parts = formatContextUsageTriggerParts({
      tokens: 0,
      contextWindow: null,
      percent: null,
    })
    expect(parts.percentText).toBe('0')
    expect(parts.windowText).toBe('—')
  })

  it('压缩后 tokens 未知时应标记 pending', () => {
    const parts = formatContextUsageTriggerParts({
      tokens: null,
      contextWindow: 128_000,
      percent: null,
    })
    expect(parts.tokensPending).toBe(true)
    expect(parts.percentText).toBe('?')
    expect(resolveContextUsageProgressPercent(parts)).toBeNull()
  })
})
