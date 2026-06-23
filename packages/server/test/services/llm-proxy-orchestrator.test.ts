import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_MODEL_STRATEGY, MUSE_PROXY_HEADERS, type ModelStrategyConfig } from '@muse-ai/shared'
import { ModelResolutionService } from '@/services/model-resolution-service.js'
import { LlmProxyOrchestrator } from '@/services/llm-proxy-orchestrator.js'
import type { LlmProxyService } from '@/services/llm-proxy-service.js'
import type { ProviderResolver, ResolvedProxyProvider } from '@/services/provider-resolver.js'

const userId = '550e8400-e29b-41d4-a716-446655440000'

function createStrategy(): ModelStrategyConfig {
  return {
    ...DEFAULT_MODEL_STRATEGY,
    pools: {
      high: ['openai/pro', 'openai/flash'],
      medium: [],
      low: [],
    },
    taskRouting: {
      chat: { type: 'tier', tier: 'high' },
      compaction: { type: 'follow_chat' },
      titleGeneration: { type: 'follow_chat' },
    },
  }
}

function mockProvider(providerId: string): ResolvedProxyProvider {
  return {
    providerId,
    baseUrl: `https://api.${providerId}.test/v1`,
    api: 'openai-completions',
    apiKey: 'test-key',
    headers: {},
  }
}

describe('LlmProxyOrchestrator', () => {
  function createOrchestrator(forward: LlmProxyService['forward']) {
    const modelResolution = new ModelResolutionService({
      loadStrategy: async () => createStrategy(),
      isProviderConfigured: async () => true,
    })
    const providerResolver = {
      resolve: vi.fn(async (_uid: string, providerId?: string) => {
        if (providerId === 'openai') return mockProvider('openai')
        return undefined
      }),
    } satisfies Pick<ProviderResolver, 'resolve'>
    const llmProxy = { forward } satisfies Pick<LlmProxyService, 'forward'>
    return {
      orchestrator: new LlmProxyOrchestrator(modelResolution, providerResolver as ProviderResolver, llmProxy as LlmProxyService, async () => ({
        providers: {},
      })),
      providerResolver,
    }
  }

  it('首候选 503 且可重试时应 fallback 到第二候选', async () => {
    const forward = vi
      .fn<LlmProxyService['forward']>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'overloaded' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [] }), { status: 200 }))

    const { orchestrator } = createOrchestrator(forward)
    const response = await orchestrator.handle({
      userId,
      suffixPath: '/chat/completions',
      body: { model: 'ignored', messages: [] },
      incomingHeaders: new Headers(),
      taskHeader: 'chat',
      selectionHeader: 'tier:high',
      providerHint: undefined,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get(MUSE_PROXY_HEADERS.RESOLVED_MODEL)).toBe('openai/flash')
    expect(response.headers.get(MUSE_PROXY_HEADERS.FALLBACK_USED)).toBe('true')
    expect(forward).toHaveBeenCalledTimes(2)
    expect(forward.mock.calls[1]?.[2]).toMatchObject({ model: 'flash' })
  })

  it('X-Muse-Last-Resolved-Model 应优先尝试上次成功模型', async () => {
    const forward = vi.fn<LlmProxyService['forward']>().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }))

    const { orchestrator } = createOrchestrator(forward)
    const response = await orchestrator.handle({
      userId,
      suffixPath: '/chat/completions',
      body: { model: 'ignored', messages: [] },
      incomingHeaders: new Headers(),
      taskHeader: 'chat',
      selectionHeader: 'tier:high',
      lastResolvedModelHeader: 'openai/flash',
      providerHint: undefined,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get(MUSE_PROXY_HEADERS.RESOLVED_MODEL)).toBe('openai/flash')
    expect(response.headers.get(MUSE_PROXY_HEADERS.FALLBACK_USED)).toBe('false')
    expect(forward).toHaveBeenCalledTimes(1)
    expect(forward.mock.calls[0]?.[2]).toMatchObject({ model: 'flash' })
  })

  it('首候选 fetch 连接失败时应 fallback 到第二候选', async () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:11434'), { code: 'ECONNREFUSED' })
    const networkError = new TypeError('fetch failed', { cause })

    const forward = vi
      .fn<LlmProxyService['forward']>()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [] }), { status: 200 }))

    const { orchestrator } = createOrchestrator(forward)
    const response = await orchestrator.handle({
      userId,
      suffixPath: '/chat/completions',
      body: { model: 'ignored', messages: [] },
      incomingHeaders: new Headers(),
      taskHeader: 'chat',
      selectionHeader: 'tier:high',
      providerHint: undefined,
    })

    expect(response.status).toBe(200)
    expect(response.headers.get(MUSE_PROXY_HEADERS.RESOLVED_MODEL)).toBe('openai/flash')
    expect(response.headers.get(MUSE_PROXY_HEADERS.FALLBACK_USED)).toBe('true')
    expect(forward).toHaveBeenCalledTimes(2)
  })

  it('400 不可重试时不应尝试下一候选', async () => {
    const forward = vi.fn<LlmProxyService['forward']>().mockResolvedValue(new Response(JSON.stringify({ error: 'bad request' }), { status: 400 }))

    const { orchestrator } = createOrchestrator(forward)
    const response = await orchestrator.handle({
      userId,
      suffixPath: '/chat/completions',
      body: { model: 'ignored', messages: [] },
      incomingHeaders: new Headers(),
      taskHeader: 'chat',
      selectionHeader: 'tier:high',
      providerHint: undefined,
    })

    expect(response.status).toBe(400)
    expect(forward).toHaveBeenCalledTimes(1)
  })

  it('首候选成功时 usedFallback 应为 false', async () => {
    const forward = vi.fn<LlmProxyService['forward']>().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }))

    const { orchestrator } = createOrchestrator(forward)
    const response = await orchestrator.handle({
      userId,
      suffixPath: '/chat/completions',
      body: { model: 'ignored', messages: [] },
      incomingHeaders: new Headers(),
      taskHeader: 'chat',
      selectionHeader: 'tier:high',
      providerHint: undefined,
    })

    expect(response.headers.get(MUSE_PROXY_HEADERS.RESOLVED_MODEL)).toBe('openai/pro')
    expect(response.headers.get(MUSE_PROXY_HEADERS.FALLBACK_USED)).toBe('false')
  })

  it('无 X-Muse-Task 时应走 legacy 单 Provider 路径', async () => {
    const forward = vi.fn<LlmProxyService['forward']>().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }))
    const providerResolver = {
      resolve: vi.fn(async () => mockProvider('openai')),
    } satisfies Pick<ProviderResolver, 'resolve'>

    const modelResolution = new ModelResolutionService({
      loadStrategy: async () => createStrategy(),
      isProviderConfigured: async () => true,
    })
    const orchestrator = new LlmProxyOrchestrator(modelResolution, providerResolver as ProviderResolver, { forward } as LlmProxyService, async () => ({
      providers: {},
    }))

    const response = await orchestrator.handle({
      userId,
      suffixPath: '/chat/completions',
      body: { model: 'gpt-4o', messages: [] },
      incomingHeaders: new Headers(),
      taskHeader: null,
      selectionHeader: null,
      providerHint: 'openai',
    })

    expect(providerResolver.resolve).toHaveBeenCalledWith(userId, 'openai')
    expect(forward).toHaveBeenCalledTimes(1)
    expect(response.headers.get(MUSE_PROXY_HEADERS.RESOLVED_MODEL)).toBeNull()
  })
})
