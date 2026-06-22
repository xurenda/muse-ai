import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MuseSessionStore } from '@muse-ai/core'
import type { SessionMeta } from '@muse-ai/shared'
import { DEFAULT_PORTS } from '@muse-ai/shared'
import { SessionEventHub } from '@/daemon/event-hub.js'
import { ModelStrategyProvider } from '@/daemon/model-strategy-provider.js'
import { SessionTitleService } from '@/daemon/session-title-service.js'
import type { SessionSettingsService } from '@/daemon/session-settings-service.js'

describe('SessionTitleService', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('nameSource 为 first_message 且首轮有 assistant 回复时应写入 auto_llm 标题', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    const updatedAt = '2026-06-16T00:00:00.000Z'
    const meta: SessionMeta = {
      id: sessionId,
      agentId: '00000000-0000-4000-8000-000000000001',
      name: '帮我写一个 todo app',
      nameSource: 'first_message',
      createdAt: updatedAt,
      updatedAt,
    }

    const sessionStore = {
      get: vi.fn(async () => meta),
      getTree: vi.fn(async () => ({
        sessionId,
        leafId: null,
        activeMessagePathIds: [],
        entries: [],
        branch: [
          { id: 'u1', role: 'user' as const, text: '帮我写一个 todo app' },
          { id: 'a1', role: 'assistant' as const, text: '可以先从需求拆分开始…' },
        ],
      })),
      updateName: vi.fn(async () => ({
        ...meta,
        name: 'Todo App 规划',
        nameSource: 'auto_llm' as const,
      })),
    } satisfies Pick<MuseSessionStore, 'get' | 'getTree' | 'updateName'>

    const sessionSettingsService = {
      get: vi.fn(async () => ({
        sessionId,
        agentId: meta.agentId,
        modelRef: 'openai/deepseek-v4-flash',
        thinkingLevel: 'off' as const,
      })),
    } satisfies Pick<SessionSettingsService, 'get'>

    const eventHub = new SessionEventHub()
    const received: unknown[] = []
    const abort = new AbortController()
    eventHub.subscribe(sessionId, {
      id: 'sub-1',
      signal: abort.signal,
      write: async event => {
        received.push(event)
      },
    })

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Todo App 规划' } }],
        }),
      })),
    )

    const modelStrategyProvider = new ModelStrategyProvider(async () => ({
      backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`,
      deviceToken: 'device-token',
    }))
    modelStrategyProvider.setStrategyForTest({
      pools: { high: [], medium: ['openai/deepseek-v4-flash'], low: [] },
      taskRouting: {
        chat: { type: 'model', modelRef: 'openai/deepseek-v4-flash' },
        compaction: { type: 'follow_chat' },
        titleGeneration: { type: 'model', modelRef: 'openai/deepseek-v4-flash' },
      },
    })

    const service = new SessionTitleService(
      sessionStore as MuseSessionStore,
      sessionSettingsService as SessionSettingsService,
      modelStrategyProvider,
      eventHub,
      async () => ({
        backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`,
        deviceToken: 'device-token',
      }),
    )

    await service.maybeGenerateAfterTurn(sessionId)

    expect(sessionStore.updateName).toHaveBeenCalledWith(sessionId, 'Todo App 规划', 'auto_llm')
    expect(fetch).toHaveBeenCalledWith(
      `http://127.0.0.1:${DEFAULT_PORTS.SERVER}/v1/chat/completions`,
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"thinking":{"type":"disabled"}'),
      }),
    )
    expect(received).toEqual([
      {
        type: 'session_meta_updated',
        sessionId,
        name: 'Todo App 规划',
        nameSource: 'auto_llm',
        updatedAt,
      },
    ])
  })

  it('manual 标题不应触发 LLM 生成', async () => {
    const sessionStore = {
      get: vi.fn(async () => ({
        id: '550e8400-e29b-41d4-a716-446655440000',
        agentId: '00000000-0000-4000-8000-000000000001',
        name: '固定标题',
        nameSource: 'manual' as const,
        createdAt: '2026-06-16T00:00:00.000Z',
        updatedAt: '2026-06-16T00:00:00.000Z',
      })),
      getTree: vi.fn(),
      updateName: vi.fn(),
    } satisfies Pick<MuseSessionStore, 'get' | 'getTree' | 'updateName'>

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const service = new SessionTitleService(
      sessionStore as MuseSessionStore,
      { get: vi.fn() } as unknown as SessionSettingsService,
      new ModelStrategyProvider(async () => ({
        backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`,
        deviceToken: 'device-token',
      })),
      new SessionEventHub(),
      async () => ({ backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`, deviceToken: 'device-token' }),
    )

    await service.maybeGenerateAfterTurn('550e8400-e29b-41d4-a716-446655440000')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(sessionStore.updateName).not.toHaveBeenCalled()
  })

  it('推理模型仅返回 reasoning_content 时不应写入标题', async () => {
    const sessionId = '550e8400-e29b-41d4-a716-446655440000'
    const sessionStore = {
      get: vi.fn(async () => ({
        id: sessionId,
        agentId: '00000000-0000-4000-8000-000000000001',
        name: '介绍下你自己',
        nameSource: 'first_message' as const,
        createdAt: '2026-06-16T00:00:00.000Z',
        updatedAt: '2026-06-16T00:00:00.000Z',
      })),
      getTree: vi.fn(async () => ({
        sessionId,
        leafId: null,
        activeMessagePathIds: [],
        entries: [],
        branch: [
          { id: 'u1', role: 'user' as const, text: '介绍下你自己' },
          { id: 'a1', role: 'assistant' as const, text: '你好！我是 MuseAI' },
        ],
      })),
      updateName: vi.fn(),
    } satisfies Pick<MuseSessionStore, 'get' | 'getTree' | 'updateName'>

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '', reasoning_content: 'only reasoning' } }],
        }),
      })),
    )

    const modelStrategyProvider = new ModelStrategyProvider(async () => ({
      backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`,
      deviceToken: 'device-token',
    }))
    modelStrategyProvider.setStrategyForTest({
      pools: { high: [], medium: [], low: [] },
      taskRouting: {
        chat: { type: 'model', modelRef: 'openai/deepseek-v4-pro' },
        compaction: { type: 'follow_chat' },
        titleGeneration: { type: 'model', modelRef: 'openai/deepseek-v4-pro' },
      },
    })

    const service = new SessionTitleService(
      sessionStore as MuseSessionStore,
      {
        get: vi.fn(async () => ({
          sessionId,
          agentId: '00000000-0000-4000-8000-000000000001',
          modelRef: 'openai/deepseek-v4-pro',
          thinkingLevel: 'low' as const,
        })),
      } as SessionSettingsService,
      modelStrategyProvider,
      new SessionEventHub(),
      async () => ({ backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`, deviceToken: 'device-token' }),
    )

    await service.maybeGenerateAfterTurn(sessionId)
    expect(sessionStore.updateName).not.toHaveBeenCalled()
  })
})
