import type { SessionTokenUsage } from '../types/session-token-usage.js'

/** 是否本场对话存在缓存 token（用于 UI 决定是否展示缓存相关行） */
export function hasSessionCacheUsage(usage: SessionTokenUsage | undefined): boolean {
  if (!usage) return false
  return usage.cacheRead > 0 || usage.cacheWrite > 0
}

/** 缓存命中率：cacheRead / (input + cacheRead + cacheWrite) */
export function computeCacheHitRate(input: number, cacheRead: number, cacheWrite: number): number | null {
  if (cacheRead <= 0 && cacheWrite <= 0) return null
  const denominator = input + cacheRead + cacheWrite
  if (denominator <= 0) return null
  return (cacheRead / denominator) * 100
}

/** 本场 Session 累计缓存命中率 */
export function computeSessionCacheHitRate(usage: SessionTokenUsage | undefined): number | null {
  if (!usage || !hasSessionCacheUsage(usage)) return null
  return computeCacheHitRate(usage.input, usage.cacheRead, usage.cacheWrite)
}
