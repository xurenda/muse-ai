import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MuseHarness } from '@muse-ai/core'
import { BUILTIN_GENERAL_AGENT_ID, DEFAULT_PORTS } from '@muse-ai/shared'
import { createCliDaemonDeps } from '@/daemon/deps.js'
import { ModelStrategyProvider } from '@/daemon/model-strategy-provider.js'

async function createPairedDeps(strategy?: Parameters<ModelStrategyProvider['setStrategyForTest']>[0]) {
  const tempHome = await mkdtemp(join(tmpdir(), 'muse-model-strategy-'))
  process.env.MUSE_HOME = tempHome
  const musePaths = {
    home: tempHome,
    config: join(tempHome, 'config.json'),
    sessions: join(tempHome, 'sessions'),
    agents: join(tempHome, 'agents'),
    personas: join(tempHome, 'personas'),
    skills: join(tempHome, 'skills'),
    mcps: join(tempHome, 'mcps'),
  }
  await writeFile(
    join(tempHome, 'config.json'),
    `${JSON.stringify(
      {
        version: 1,
        deviceToken: 'test-device-token',
        backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`,
      },
      null,
      2,
    )}\n`,
  )

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/settings/model-strategy')) {
        return new Response(
          JSON.stringify({
            strategy: strategy ?? {
              pools: {
                high: ['openai/deepseek-v4-pro', 'openai/deepseek-v4-pro-backup'],
                medium: ['openai/deepseek-v4-flash'],
                low: ['openai/deepseek-v4-flash'],
              },
              taskRouting: {
                chat: { type: 'tier', tier: 'medium' },
                compaction: { type: 'model', modelRef: 'openai/deepseek-v4-pro' },
                titleGeneration: { type: 'model', modelRef: 'openai/deepseek-v4-flash' },
              },
            },
            options: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )

  const deps = await createCliDaemonDeps({ musePaths, cwd: tempHome })
  return { deps, tempHome }
}

describe('SessionSettingsService modelSelection', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('patch tier 后 get 应回显 modelSelection', async () => {
    const { deps } = await createPairedDeps()
    vi.spyOn(MuseHarness.prototype, 'setModel').mockResolvedValue(undefined as never)

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    const patched = await deps.sessionSettingsService.patch(session.id, {
      modelSelection: { type: 'tier', tier: 'high' },
    })

    expect(patched.modelSelection).toEqual({ type: 'tier', tier: 'high' })
    expect(patched.modelRef).toBe('openai/deepseek-v4-pro')
  })
})

describe('ChatService 任务路由', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('compact 应使用 taskRouting.compaction 指定的模型', async () => {
    const { deps } = await createPairedDeps()
    let compactModelId: string | undefined
    vi.spyOn(MuseHarness.prototype, 'compact').mockImplementation(async function (this: MuseHarness) {
      compactModelId = this.getModel().id
      return {
        summary: 'summary',
        firstKeptEntryId: 'entry-1',
        tokensBefore: 50_000,
      }
    })
    vi.spyOn(MuseHarness.prototype, 'subscribe').mockImplementation(() => () => {})

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    await deps.chatService.enqueueCompact(session.id)
    await new Promise(resolve => setTimeout(resolve, 80))

    expect(compactModelId).toBe('deepseek-v4-pro')
  })

  it('prompt 遇可重试错误时应 fallback 到 tier 内下一个模型', async () => {
    const { deps } = await createPairedDeps()
    const setModelSpy = vi.spyOn(MuseHarness.prototype, 'setModel').mockResolvedValue(undefined as never)
    vi.spyOn(MuseHarness.prototype, 'subscribe').mockImplementation(() => () => {})

    let attempt = 0
    vi.spyOn(MuseHarness.prototype, 'prompt').mockImplementation(async () => {
      attempt += 1
      if (attempt === 1) {
        throw new Error('503 service unavailable')
      }
      return {
        role: 'assistant',
        content: [{ type: 'text', text: 'ok' }],
        stopReason: 'end_turn',
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      } as never
    })

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    await deps.sessionSettingsService.patch(session.id, {
      modelSelection: { type: 'tier', tier: 'high' },
    })

    await deps.chatService.enqueue({ sessionId: session.id, message: '你好', mode: 'prompt' })
    await new Promise(resolve => setTimeout(resolve, 80))

    expect(attempt).toBe(2)
    expect(setModelSpy.mock.calls.some(call => call[0]?.id === 'deepseek-v4-pro-backup')).toBe(true)
  })
})

describe('SessionTitleService 任务路由', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('标题生成应使用 taskRouting.titleGeneration 而非会话主模型', async () => {
    const strategy = {
      pools: {
        high: ['openai/deepseek-v4-pro'],
        medium: ['openai/deepseek-v4-flash'],
        low: [],
      },
      taskRouting: {
        chat: { type: 'model' as const, modelRef: 'openai/deepseek-v4-pro' },
        compaction: { type: 'follow_chat' as const },
        titleGeneration: { type: 'model' as const, modelRef: 'openai/deepseek-v4-flash' },
      },
    }
    const { deps } = await createPairedDeps(strategy)

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    await deps.sessionStore.updateName(session.id, '帮我写 todo', 'first_message')

    vi.spyOn(deps.sessionStore, 'getTree').mockResolvedValue({
      sessionId: session.id,
      leafId: null,
      activeMessagePathIds: [],
      entries: [],
      branch: [
        { id: 'u1', role: 'user' as const, text: '帮我写 todo' },
        { id: 'a1', role: 'assistant' as const, text: '好的' },
      ],
    })
    vi.spyOn(deps.sessionStore, 'updateName').mockResolvedValue({
      ...session,
      name: 'Todo',
      nameSource: 'auto_llm' as const,
    })

    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/settings/model-strategy')) {
        return new Response(JSON.stringify({ strategy, options: [] }), { status: 200 })
      }
      if (url.includes('/v1/chat/completions')) {
        return new Response(JSON.stringify({ choices: [{ message: { content: 'Todo' } }] }), { status: 200 })
      }
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    await deps.sessionTitleService.maybeGenerateAfterTurn(session.id)

    const completionCall = fetchMock.mock.calls.find(call => String(call[0]).includes('/v1/chat/completions'))
    expect(completionCall).toBeDefined()
    const body = JSON.parse(String(completionCall?.[1]?.body))
    expect(body.model).toBe('deepseek-v4-flash')
  })
})
