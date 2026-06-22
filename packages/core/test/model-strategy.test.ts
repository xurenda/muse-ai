import { describe, expect, it } from 'vitest'
import type { ModelStrategyConfig, ModelStrategyPools } from '@muse-ai/shared'
import {
  expandModelSelection,
  expandTaskModelSelection,
  extractHttpStatus,
  isRetryableModelError,
  resolveNextModelCandidate,
  resolvePrimaryModelCandidate,
} from '@/model-strategy.js'

const pools: ModelStrategyPools = {
  high: ['openai/deepseek-v4-pro', 'anthropic/claude-sonnet-4-20250514'],
  medium: ['openai/deepseek-v4-flash'],
  low: ['openai/deepseek-v4-flash'],
}

describe('expandModelSelection', () => {
  it('model 类型应只返回单个 ref', () => {
    expect(expandModelSelection({ type: 'model', modelRef: 'openai/custom' }, pools)).toEqual(['openai/custom'])
  })

  it('tier 类型应返回对应池顺序', () => {
    expect(expandModelSelection({ type: 'tier', tier: 'high' }, pools)).toEqual(pools.high)
  })

  it('空池应返回空数组', () => {
    expect(expandModelSelection({ type: 'tier', tier: 'high' }, { high: [], medium: [], low: [] })).toEqual([])
  })
})

describe('expandTaskModelSelection', () => {
  it('follow_chat 应展开会话 selection', () => {
    expect(expandTaskModelSelection({ type: 'follow_chat' }, { type: 'tier', tier: 'medium' }, pools)).toEqual(pools.medium)
  })

  it('具体 model 任务应忽略 follow', () => {
    expect(expandTaskModelSelection({ type: 'model', modelRef: 'openai/title-model' }, { type: 'tier', tier: 'high' }, pools)).toEqual(['openai/title-model'])
  })
})

describe('resolvePrimaryModelCandidate', () => {
  it('有候选时应返回首个', () => {
    expect(resolvePrimaryModelCandidate({ type: 'tier', tier: 'high' }, pools)).toEqual({
      modelRef: pools.high[0],
      candidates: pools.high,
      candidateIndex: 0,
      usedFallback: false,
    })
  })

  it('空池应返回 null', () => {
    expect(resolvePrimaryModelCandidate({ type: 'tier', tier: 'high' }, { high: [], medium: [], low: [] })).toBeNull()
  })
})

describe('resolveNextModelCandidate', () => {
  it('应有下一个候选并标记 usedFallback', () => {
    const primary = resolvePrimaryModelCandidate({ type: 'tier', tier: 'high' }, pools)
    expect(primary).not.toBeNull()
    const next = resolveNextModelCandidate(primary!)
    expect(next).toEqual({
      modelRef: pools.high[1],
      candidates: pools.high,
      candidateIndex: 1,
      usedFallback: true,
    })
  })

  it('无更多候选时应返回 null', () => {
    const primary = resolvePrimaryModelCandidate({ type: 'model', modelRef: 'openai/only' }, pools)
    expect(resolveNextModelCandidate(primary!)).toBeNull()
  })
})

describe('isRetryableModelError', () => {
  it('429/503 应可 retry', () => {
    expect(isRetryableModelError({ status: 429 })).toBe(true)
    expect(isRetryableModelError({ status: 503 })).toBe(true)
  })

  it('400 不应 retry', () => {
    expect(isRetryableModelError({ status: 400 })).toBe(false)
  })

  it('内容策略错误不应 retry', () => {
    expect(isRetryableModelError(new Error('content policy violation'))).toBe(false)
  })

  it('超时应 retry', () => {
    const error = new Error('request timed out')
    error.name = 'TimeoutError'
    expect(isRetryableModelError(error)).toBe(true)
  })

  it('fetch 连接失败（含 cause ECONNREFUSED）应 retry', () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), { code: 'ECONNREFUSED' })
    const error = new TypeError('fetch failed', { cause })
    expect(isRetryableModelError(error)).toBe(true)
  })
})

describe('extractHttpStatus', () => {
  it('应读取 status 与 statusCode', () => {
    expect(extractHttpStatus({ status: 503 })).toBe(503)
    expect(extractHttpStatus({ statusCode: 401 })).toBe(401)
  })
})

describe('collectModelRefsFromStrategy', () => {
  it('应收集池与任务中的 model ref', async () => {
    const { collectModelRefsFromStrategy } = await import('@muse-ai/shared')
    const strategy: ModelStrategyConfig = {
      pools,
      taskRouting: {
        chat: { type: 'tier', tier: 'high' },
        compaction: { type: 'follow_chat' },
        titleGeneration: { type: 'model', modelRef: 'openai/title-mini' },
      },
    }
    expect(collectModelRefsFromStrategy(strategy)).toEqual([
      'openai/deepseek-v4-pro',
      'anthropic/claude-sonnet-4-20250514',
      'openai/deepseek-v4-flash',
      'openai/title-mini',
    ])
  })
})
