import { describe, expect, it } from 'vitest'
import { DEFAULT_MODEL_STRATEGY } from '@muse-ai/shared'
import { resolveEffectiveChatModelSelection, resolvePrimaryModelRef, resolveTaskModelCandidates } from '@/model-strategy-resolver.js'

describe('resolveEffectiveChatModelSelection', () => {
  it('应优先使用会话 selection', () => {
    expect(resolveEffectiveChatModelSelection({ type: 'tier', tier: 'high' }, DEFAULT_MODEL_STRATEGY, 'openai/persona')).toEqual({ type: 'tier', tier: 'high' })
  })

  it('无会话 selection 时应回退 taskRouting.chat', () => {
    expect(resolveEffectiveChatModelSelection(undefined, DEFAULT_MODEL_STRATEGY, 'openai/persona')).toEqual({
      type: 'tier',
      tier: 'medium',
    })
  })
})

describe('resolveTaskModelCandidates', () => {
  const strategy = {
    pools: {
      high: ['openai/pro'],
      medium: ['openai/flash'],
      low: ['openai/mini'],
    },
    taskRouting: {
      chat: { type: 'tier' as const, tier: 'medium' as const },
      compaction: { type: 'model' as const, modelRef: 'openai/compact' },
      titleGeneration: { type: 'follow_chat' as const },
    },
  }

  it('title follow_chat 应跟随 chat selection', () => {
    expect(resolveTaskModelCandidates('titleGeneration', strategy, { type: 'tier', tier: 'high' })).toEqual(['openai/pro'])
  })

  it('compaction 应用独立 model', () => {
    expect(resolveTaskModelCandidates('compaction', strategy, { type: 'tier', tier: 'high' })).toEqual(['openai/compact'])
  })
})

describe('resolvePrimaryModelRef', () => {
  it('tier 应取池首项', () => {
    expect(resolvePrimaryModelRef({ type: 'tier', tier: 'medium' }, { high: [], medium: ['openai/flash'], low: [] })).toBe('openai/flash')
  })
})
