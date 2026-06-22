import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MuseSessionStore } from '@muse-ai/core'
import type { SessionMeta } from '@muse-ai/shared'
import { DEFAULT_PORTS, MUSE_PROXY_HEADERS } from '@muse-ai/shared'
import { SessionEventHub } from '@/daemon/event-hub.js'
import { SessionTitleService } from '@/daemon/session-title-service.js'

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
      vi.fn(
        async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: 'Todo App 规划' } }] }), {
            status: 200,
            headers: {
              [MUSE_PROXY_HEADERS.RESOLVED_MODEL]: 'openai/deepseek-v4-flash',
              [MUSE_PROXY_HEADERS.FALLBACK_USED]: 'false',
            },
          }),
      ),
    )

    const service = new SessionTitleService(sessionStore as MuseSessionStore, eventHub, async () => ({
      backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`,
      deviceToken: 'device-token',
    }))

    await service.maybeGenerateAfterTurn(sessionId)

    expect(sessionStore.updateName).toHaveBeenCalledWith(sessionId, 'Todo App 规划', 'auto_llm')
    expect(fetch).toHaveBeenCalledWith(
      `http://127.0.0.1:${DEFAULT_PORTS.SERVER}/v1/chat/completions`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          [MUSE_PROXY_HEADERS.TASK]: 'titleGeneration',
        }),
        body: expect.stringContaining('"thinking":{"type":"disabled"}'),
      }),
    )
    expect(received).toEqual([
      {
        type: 'model_resolved',
        modelRef: 'openai/deepseek-v4-flash',
        task: 'titleGeneration',
      },
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

    const service = new SessionTitleService(sessionStore as MuseSessionStore, new SessionEventHub(), async () => ({
      backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`,
      deviceToken: 'device-token',
    }))

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
      vi.fn(
        async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: '', reasoning_content: 'only reasoning' } }] }), {
            status: 200,
            headers: { [MUSE_PROXY_HEADERS.RESOLVED_MODEL]: 'openai/deepseek-v4-pro' },
          }),
      ),
    )

    const service = new SessionTitleService(sessionStore as MuseSessionStore, new SessionEventHub(), async () => ({
      backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`,
      deviceToken: 'device-token',
    }))

    await service.maybeGenerateAfterTurn(sessionId)
    expect(sessionStore.updateName).not.toHaveBeenCalled()
  })
})
