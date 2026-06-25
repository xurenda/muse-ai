import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODEL_STRATEGY, type ModelStrategyConfig } from '@museai/shared'
import { ModelResolutionError, ModelResolutionService } from '@/services/model-resolution-service.js'

function createStrategy(overrides?: Partial<ModelStrategyConfig>): ModelStrategyConfig {
  return {
    ...DEFAULT_MODEL_STRATEGY,
    pools: {
      high: ['openai/pro', 'anthropic/sonnet'],
      medium: ['openai/flash'],
      low: ['openai/mini'],
    },
    taskRouting: {
      chat: { type: 'tier', tier: 'high' },
      compaction: { type: 'follow_chat' },
      titleGeneration: { type: 'tier', tier: 'low' },
    },
    ...overrides,
  }
}

describe('ModelResolutionService', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000'

  function createService(configuredProviders: ReadonlySet<string>) {
    return new ModelResolutionService({
      loadStrategy: async () => createStrategy(),
      isProviderConfigured: async (_uid, providerId) => configuredProviders.has(providerId),
    })
  }

  it('chat tier 应展开 high 池并过滤未配置 Provider', async () => {
    const service = createService(new Set(['openai']))
    const result = await service.resolveCandidates({
      userId,
      task: 'chat',
      selectionHeader: 'tier:high',
    })

    expect(result.expandedCandidates).toEqual(['openai/pro', 'anthropic/sonnet'])
    expect(result.candidates).toEqual(['openai/pro'])
    expect(result.chatSelection).toEqual({ type: 'tier', tier: 'high' })
  })

  it('无 selectionHeader 时应使用 taskRouting.chat', async () => {
    const service = createService(new Set(['openai', 'anthropic']))
    const result = await service.resolveCandidates({
      userId,
      task: 'chat',
    })

    expect(result.candidates).toEqual(['openai/pro', 'anthropic/sonnet'])
  })

  it('compaction follow_chat 应跟随 chat selection', async () => {
    const service = createService(new Set(['openai']))
    const result = await service.resolveCandidates({
      userId,
      task: 'compaction',
      selectionHeader: 'tier:high',
    })

    expect(result.candidates).toEqual(['openai/pro'])
  })

  it('titleGeneration 应使用 taskRouting 独立配置', async () => {
    const service = createService(new Set(['openai']))
    const result = await service.resolveCandidates({
      userId,
      task: 'titleGeneration',
    })

    expect(result.candidates).toEqual(['openai/mini'])
    expect(result.chatSelection).toEqual({ type: 'tier', tier: 'high' })
  })

  it('非法 selectionHeader 应抛出 ModelResolutionError', async () => {
    const service = createService(new Set(['openai']))
    await expect(
      service.resolveCandidates({
        userId,
        task: 'chat',
        selectionHeader: 'tier:invalid',
      }),
    ).rejects.toBeInstanceOf(ModelResolutionError)
  })

  it('池全未配置时应返回空 candidates', async () => {
    const service = createService(new Set())
    const result = await service.resolveCandidates({
      userId,
      task: 'chat',
      selectionHeader: 'model:openai/gpt-4o',
    })

    expect(result.candidates).toEqual([])
  })

  it('loadStrategy 应只调用一次', async () => {
    const loadStrategy = vi.fn(async () => createStrategy())
    const service = new ModelResolutionService({
      loadStrategy,
      isProviderConfigured: async () => true,
    })

    await service.resolveCandidates({ userId, task: 'chat' })
    expect(loadStrategy).toHaveBeenCalledTimes(1)
  })
})
