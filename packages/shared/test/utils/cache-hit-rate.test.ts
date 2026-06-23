import { describe, expect, it } from 'vitest'
import { computeCacheHitRate, computeSessionCacheHitRate, hasSessionCacheUsage } from '@/utils/cache-hit-rate.js'
import type { SessionTokenUsage } from '@/types/session-token-usage.js'

describe('cache-hit-rate', () => {
  it('无 cache token 时不应展示缓存', () => {
    const usage: SessionTokenUsage = { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, total: 150, turnCount: 1 }
    expect(hasSessionCacheUsage(usage)).toBe(false)
    expect(computeSessionCacheHitRate(usage)).toBeNull()
  })

  it('应计算 Session 累计命中率', () => {
    const usage: SessionTokenUsage = { input: 100, output: 50, cacheRead: 400, cacheWrite: 0, total: 550, turnCount: 2 }
    expect(hasSessionCacheUsage(usage)).toBe(true)
    expect(computeSessionCacheHitRate(usage)).toBeCloseTo(80, 5)
  })

  it('应计算单轮命中率', () => {
    expect(computeCacheHitRate(50, 150, 0)).toBe(75)
    expect(computeCacheHitRate(0, 0, 0)).toBeNull()
  })
})
