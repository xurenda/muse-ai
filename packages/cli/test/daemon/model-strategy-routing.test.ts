import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MuseHarness } from '@muse-ai/core'
import { BUILTIN_GENERAL_AGENT_ID, DEFAULT_PORTS, MUSE_PROXY_HEADERS } from '@muse-ai/shared'
import { createBackendGetApiKeyAndHeaders } from '@/backend/llm-auth.js'
import { createCliDaemonDeps } from '@/daemon/deps.js'

async function createPairedDeps() {
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
    vi.spyOn(MuseHarness.prototype, 'setThinkingLevel').mockResolvedValue(undefined as never)

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    const patched = await deps.sessionSettingsService.patch(session.id, {
      modelSelection: { type: 'tier', tier: 'high' },
    })

    expect(patched.modelSelection).toEqual({ type: 'tier', tier: 'high' })
    expect(patched.modelRef).toContain('/')
  })
})

describe('ChatService Muse 代理', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('compact 应使用 muse/proxy 占位 model', async () => {
    const { deps } = await createPairedDeps()
    let compactProvider: string | undefined
    vi.spyOn(MuseHarness.prototype, 'compact').mockImplementation(async function (this: MuseHarness) {
      compactProvider = this.getModel().provider
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

    expect(compactProvider).toBe('muse')
  })

  it('getApiKeyAndHeaders 应附带 X-Muse-Task 与 X-Muse-Selection', async () => {
    const getter = createBackendGetApiKeyAndHeaders(
      { backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`, deviceToken: 'token' },
      { task: 'chat', selection: { type: 'tier', tier: 'high' } },
    )
    const result = await getter({ provider: 'muse' })
    expect(result?.headers?.[MUSE_PROXY_HEADERS.TASK]).toBe('chat')
    expect(result?.headers?.[MUSE_PROXY_HEADERS.SELECTION]).toBe('tier:high')
  })
})

describe('SessionTitleService 代理头', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('标题生成应附带 titleGeneration task 头', async () => {
    const { deps } = await createPairedDeps()
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

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Todo' } }] }), {
        status: 200,
        headers: {
          [MUSE_PROXY_HEADERS.RESOLVED_MODEL]: 'openai/deepseek-v4-flash',
          [MUSE_PROXY_HEADERS.FALLBACK_USED]: 'false',
        },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await deps.sessionTitleService.maybeGenerateAfterTurn(session.id)

    const completionCall = fetchMock.mock.calls.find(call => String(call[0]).includes('/v1/chat/completions'))
    expect(completionCall).toBeDefined()
    expect(completionCall?.[1]?.headers).toMatchObject({
      [MUSE_PROXY_HEADERS.TASK]: 'titleGeneration',
    })
  })
})
