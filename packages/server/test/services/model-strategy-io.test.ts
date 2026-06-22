import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL_STRATEGY, dedupeModelPoolRefs } from '@muse-ai/shared'
import {
  deriveLegacyDefaultFromStrategy,
  migrateModelStrategyFromLegacy,
  normalizeUpdateModelStrategy,
  parseStoredModelStrategy,
  serializeModelStrategy,
} from '@/services/model-strategy-io.js'

describe('parseStoredModelStrategy', () => {
  it('合法 JSON 应解析', () => {
    const json = serializeModelStrategy(DEFAULT_MODEL_STRATEGY)
    expect(parseStoredModelStrategy(json)).toEqual(DEFAULT_MODEL_STRATEGY)
  })

  it('非法 JSON 应返回 null', () => {
    expect(parseStoredModelStrategy('{bad')).toBeNull()
    expect(parseStoredModelStrategy(null)).toBeNull()
  })
})

describe('migrateModelStrategyFromLegacy', () => {
  it('无 legacy 时应返回默认策略', () => {
    expect(migrateModelStrategyFromLegacy({})).toEqual(DEFAULT_MODEL_STRATEGY)
  })

  it('应从 defaultProvider/defaultModel 迁移到 medium 池', () => {
    const strategy = migrateModelStrategyFromLegacy({
      defaultProvider: 'openai',
      defaultModel: 'deepseek-v4-flash',
    })
    expect(strategy.pools.medium).toEqual(['openai/deepseek-v4-flash'])
    expect(strategy.taskRouting.chat).toEqual({ type: 'model', modelRef: 'openai/deepseek-v4-flash' })
  })

  it('已有 modelStrategyJson 时不应再迁移 legacy', () => {
    const stored = {
      ...DEFAULT_MODEL_STRATEGY,
      taskRouting: {
        ...DEFAULT_MODEL_STRATEGY.taskRouting,
        chat: { type: 'tier' as const, tier: 'low' as const },
      },
    }
    const strategy = migrateModelStrategyFromLegacy({
      defaultProvider: 'openai',
      defaultModel: 'deepseek-v4-flash',
      modelStrategyJson: serializeModelStrategy(stored),
    })
    expect(strategy.taskRouting.chat).toEqual({ type: 'tier', tier: 'low' })
  })
})

describe('deriveLegacyDefaultFromStrategy', () => {
  it('chat 为 model 时应解析 provider/model', () => {
    expect(
      deriveLegacyDefaultFromStrategy({
        pools: DEFAULT_MODEL_STRATEGY.pools,
        taskRouting: {
          ...DEFAULT_MODEL_STRATEGY.taskRouting,
          chat: { type: 'model', modelRef: 'deepseek/deepseek-chat' },
        },
      }),
    ).toEqual({ defaultProvider: 'deepseek', defaultModel: 'deepseek-chat' })
  })

  it('chat 为 tier 时应取池首项', () => {
    expect(
      deriveLegacyDefaultFromStrategy({
        pools: {
          high: ['openai/pro'],
          medium: ['openai/flash'],
          low: [],
        },
        taskRouting: {
          ...DEFAULT_MODEL_STRATEGY.taskRouting,
          chat: { type: 'tier', tier: 'medium' },
        },
      }),
    ).toEqual({ defaultProvider: 'openai', defaultModel: 'flash' })
  })
})

describe('normalizeUpdateModelStrategy', () => {
  it('应去重各档池内 modelRef', () => {
    const normalized = normalizeUpdateModelStrategy({
      pools: {
        high: ['openai/a', 'openai/a', 'openai/b'],
        medium: [],
        low: [],
      },
      taskRouting: DEFAULT_MODEL_STRATEGY.taskRouting,
    })
    expect(normalized.pools.high).toEqual(['openai/a', 'openai/b'])
  })
})

describe('dedupeModelPoolRefs', () => {
  it('应保留首次出现顺序', () => {
    expect(dedupeModelPoolRefs(['a/b', 'c/d', 'a/b'])).toEqual(['a/b', 'c/d'])
  })
})
