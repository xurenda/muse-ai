import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL_STRATEGY, appendModelRefsToAllPools } from '@muse-ai/shared'

describe('appendModelRefsToAllPools', () => {
  it('应将 modelRef 追加到三档模型组', () => {
    const next = appendModelRefsToAllPools(DEFAULT_MODEL_STRATEGY, ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro'])
    expect(next.pools.high).toEqual(['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro'])
    expect(next.pools.medium).toEqual(['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro'])
    expect(next.pools.low).toEqual(['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro'])
  })

  it('已存在的 modelRef 不应重复追加', () => {
    const base = {
      ...DEFAULT_MODEL_STRATEGY,
      pools: {
        high: ['deepseek/deepseek-v4-flash'],
        medium: [],
        low: ['deepseek/deepseek-v4-flash'],
      },
    }
    const next = appendModelRefsToAllPools(base, ['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro'])
    expect(next.pools.high).toEqual(['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro'])
    expect(next.pools.low).toEqual(['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-pro'])
  })
})
