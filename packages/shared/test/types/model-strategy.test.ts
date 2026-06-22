import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MODEL_STRATEGY,
  modelSelectionSchema,
  modelStrategyConfigSchema,
  taskModelSelectionSchema,
  updateModelStrategyRequestSchema,
} from '@/types/model-strategy.js'
import { dedupeModelPoolRefs, normalizeModelStrategyPools } from '@/utils/model-strategy.js'

describe('modelSelectionSchema', () => {
  it('应接受 tier 与 model', () => {
    expect(modelSelectionSchema.safeParse({ type: 'tier', tier: 'high' }).success).toBe(true)
    expect(modelSelectionSchema.safeParse({ type: 'model', modelRef: 'openai/deepseek-v4-flash' }).success).toBe(true)
  })

  it('应拒绝 auto（本版本未启用）', () => {
    expect(modelSelectionSchema.safeParse({ type: 'auto' }).success).toBe(false)
  })
})

describe('taskModelSelectionSchema', () => {
  it('应接受 follow_chat', () => {
    expect(taskModelSelectionSchema.safeParse({ type: 'follow_chat' }).success).toBe(true)
  })
})

describe('modelStrategyConfigSchema', () => {
  it('默认策略应通过校验', () => {
    expect(modelStrategyConfigSchema.safeParse(DEFAULT_MODEL_STRATEGY).success).toBe(true)
    expect(updateModelStrategyRequestSchema.safeParse(DEFAULT_MODEL_STRATEGY).success).toBe(true)
  })
})

describe('normalizeModelStrategyPools', () => {
  it('应去重各 tier', () => {
    expect(
      normalizeModelStrategyPools({
        high: ['openai/a', 'openai/a'],
        medium: [],
        low: ['openai/b'],
      }),
    ).toEqual({
      high: ['openai/a'],
      medium: [],
      low: ['openai/b'],
    })
  })
})

describe('dedupeModelPoolRefs', () => {
  it('应保留顺序', () => {
    expect(dedupeModelPoolRefs(['x/y', 'a/b', 'x/y'])).toEqual(['x/y', 'a/b'])
  })
})
