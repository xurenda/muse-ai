import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MuseSseEvent } from '@museai/shared'
import {
  BUILTIN_CODING_AGENT_ID,
  BUILTIN_GENERAL_AGENT_ID,
  BUILTIN_PERSONA_GENERAL,
  BASIC_KIT_PACKAGE_ID,
  CLI_API_PATHS,
  DEFAULT_PORTS,
  sessionEventsPath,
} from '@museai/shared'
import { loadCliConfig } from '@/config.js'
import { createCliDaemonDeps } from '@/daemon/deps.js'
import { createSseSubscriber } from '@/daemon/event-hub.js'
import { createCliApp } from '@/daemon/server.js'
import { MarketInstallerError } from '@/market/market-errors.js'
import * as marketInstaller from '@/market/market-installer.js'
import { seedTestAssets } from '../helpers/seed-test-assets.js'

async function createTestApp() {
  const tempHome = await mkdtemp(join(tmpdir(), 'muse-cli-daemon-'))
  process.env.MUSE_HOME = tempHome
  const musePaths = {
    home: tempHome,
    config: join(tempHome, 'config.json'),
    sessions: join(tempHome, 'sessions'),
    agents: join(tempHome, 'agents'),
    personas: join(tempHome, 'personas'),
    skills: join(tempHome, 'skills'),
    mcps: join(tempHome, 'mcps'),
    llmInspect: join(tempHome, 'llm-inspect'),
    market: join(tempHome, 'market'),
  }
  await seedTestAssets(musePaths)
  const deps = await createCliDaemonDeps({ musePaths, cwd: tempHome })
  const app = createCliApp(loadCliConfig({}), deps)
  return { app, deps, tempHome }
}

describe('loadCliConfig', () => {
  it('应使用默认端口 65433', () => {
    const config = loadCliConfig({})
    expect(config.port).toBe(DEFAULT_PORTS.CLI)
    expect(config.host).toBe('127.0.0.1')
  })

  it('应解析 MUSE_CLI_PORT', () => {
    const config = loadCliConfig({ MUSE_CLI_PORT: '9000' })
    expect(config.port).toBe(9000)
  })
})

describe('createCliApp', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
  })

  it('GET /health 应返回 ok', async () => {
    const { app } = await createTestApp()
    const res = await app.request('http://localhost/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, service: 'cli' })
  })

  it('GET /agents 应返回内置 Agent 列表', async () => {
    const { app } = await createTestApp()
    const res = await app.request('http://localhost/agents')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { agents: Array<{ id: string; name: string }> }
    expect(body.agents.some(a => a.id === BUILTIN_GENERAL_AGENT_ID)).toBe(true)
    expect(body.agents.some(a => a.id === BUILTIN_CODING_AGENT_ID)).toBe(true)
  })

  it('POST /sessions 与 GET /sessions 应持久化元数据', async () => {
    const { app } = await createTestApp()

    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: BUILTIN_GENERAL_AGENT_ID, name: 'demo' }),
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as { session: { id: string } }

    const listRes = await app.request('http://localhost/sessions')
    expect(listRes.status).toBe(200)
    const listed = (await listRes.json()) as { sessions: Array<{ id: string }> }
    expect(listed.sessions.some(s => s.id === created.session.id)).toBe(true)

    const registry = await readFile(join(process.env.MUSE_HOME!, 'sessions', 'registry.json'), 'utf8')
    expect(registry).toContain(created.session.id)
  })

  it('POST /sessions 省略 agentId 时应使用默认 Agent', async () => {
    const { app } = await createTestApp()

    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'default-agent' }),
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as { session: { agentId: string } }
    expect(created.session.agentId).toBe(BUILTIN_GENERAL_AGENT_ID)
  })

  it('POST /sessions 应使用 config.activeAgentId', async () => {
    const { app, tempHome } = await createTestApp()
    await writeFile(join(tempHome, 'config.json'), `${JSON.stringify({ version: 1, activeAgentId: BUILTIN_CODING_AGENT_ID }, null, 2)}\n`)

    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as { session: { agentId: string } }
    expect(created.session.agentId).toBe(BUILTIN_CODING_AGENT_ID)
  })

  it('POST /sessions 应持久化 modelSelection', async () => {
    const { app } = await createTestApp()

    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: BUILTIN_GENERAL_AGENT_ID,
        modelSelection: { type: 'tier', tier: 'medium' },
      }),
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as { session: { modelSelection?: { type: string; tier: string } } }
    expect(created.session.modelSelection).toEqual({ type: 'tier', tier: 'medium' })
  })

  it('GET /sessions/:id/events 应返回 event-stream', async () => {
    const { app } = await createTestApp()

    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: BUILTIN_GENERAL_AGENT_ID }),
    })
    const { session } = (await createRes.json()) as { session: { id: string } }

    const abort = new AbortController()
    setTimeout(() => abort.abort(), 50)

    const res = await app.request(`http://localhost${sessionEventsPath(session.id)}`, { signal: abort.signal })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
  })

  it('POST /chat 应接受请求并返回 202', async () => {
    const { app } = await createTestApp()

    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: BUILTIN_GENERAL_AGENT_ID }),
    })
    const { session } = (await createRes.json()) as { session: { id: string } }

    const chatRes = await app.request('http://localhost/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, message: '你好', mode: 'prompt' }),
    })
    expect(chatRes.status).toBe(202)
    const body = await chatRes.json()
    expect(body).toEqual({ accepted: true })

    const listRes = await app.request('http://localhost/sessions')
    const listed = (await listRes.json()) as { sessions: Array<{ id: string; name?: string; nameSource?: string }> }
    const current = listed.sessions.find(item => item.id === session.id)
    expect(current?.name).toBe('你好')
    expect(current?.nameSource).toBe('first_message')
  })

  it('PATCH /sessions/:id 应重命名会话', async () => {
    const { app } = await createTestApp()
    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: BUILTIN_GENERAL_AGENT_ID }),
    })
    const { session } = (await createRes.json()) as { session: { id: string } }

    const patchRes = await app.request(`http://localhost/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '我的对话' }),
    })
    expect(patchRes.status).toBe(200)
    const patched = (await patchRes.json()) as { session: { name?: string; nameSource?: string } }
    expect(patched.session.name).toBe('我的对话')
    expect(patched.session.nameSource).toBe('manual')
  })

  it('DELETE /sessions/:id 应删除会话', async () => {
    const { app } = await createTestApp()
    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: BUILTIN_GENERAL_AGENT_ID }),
    })
    const { session } = (await createRes.json()) as { session: { id: string } }

    const deleteRes = await app.request(`http://localhost/sessions/${session.id}`, { method: 'DELETE' })
    expect(deleteRes.status).toBe(200)
    const deleted = (await deleteRes.json()) as { deleted: boolean; sessionId: string }
    expect(deleted).toEqual({ deleted: true, sessionId: session.id })

    const listRes = await app.request('http://localhost/sessions')
    const listed = (await listRes.json()) as { sessions: Array<{ id: string }> }
    expect(listed.sessions.some(item => item.id === session.id)).toBe(false)
  })

  it('GET /personas 与 GET /tools 应返回资产列表', async () => {
    const { app } = await createTestApp()
    const personasRes = await app.request('http://localhost/personas')
    expect(personasRes.status).toBe(200)
    const personasBody = (await personasRes.json()) as { personas: Array<{ id: string; source: string }> }
    const general = personasBody.personas.find(p => p.id === BUILTIN_PERSONA_GENERAL)
    expect(general).toBeTruthy()
    expect(general?.source).toBe('local')

    const toolsRes = await app.request('http://localhost/tools')
    expect(toolsRes.status).toBe(200)
    const toolsBody = (await toolsRes.json()) as { tools: Array<{ name: string }> }
    expect(toolsBody.tools.some(t => t.name === 'read')).toBe(true)
  })

  it('GET /personas 有 .muse-origin.json 时应返回 source=market', async () => {
    const { app, tempHome } = await createTestApp()
    const personaDir = join(tempHome, 'personas', 'museai/basic-kit/general')
    await mkdir(personaDir, { recursive: true })
    await writeFile(
      join(personaDir, '.muse-origin.json'),
      `${JSON.stringify({ packageId: BASIC_KIT_PACKAGE_ID, packageVersion: '1.0.0', installedAt: '2026-01-01T00:00:00.000Z' })}\n`,
    )

    const res = await app.request('http://localhost/personas')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { personas: Array<{ id: string; source: string }> }
    const general = body.personas.find(p => p.id === BUILTIN_PERSONA_GENERAL)
    expect(general?.source).toBe('market')
  })

  it('GET /skills 应返回带 source 的资产列表', async () => {
    const { app } = await createTestApp()
    const res = await app.request('http://localhost/skills')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { skills: Array<{ id: string; source: string }> }
    expect(body.skills.length).toBeGreaterThan(0)
    expect(body.skills.every(skill => skill.source === 'local' || skill.source === 'market')).toBe(true)
  })

  it('GET /market/installed 应返回 installed.json', async () => {
    const { app, tempHome } = await createTestApp()
    await mkdir(join(tempHome, 'market'), { recursive: true })
    await writeFile(
      join(tempHome, 'market', 'installed.json'),
      `${JSON.stringify({
        packages: {
          [BASIC_KIT_PACKAGE_ID]: {
            version: '1.0.0',
            installedAt: '2026-01-01T00:00:00.000Z',
            assets: [{ type: 'persona', id: BUILTIN_PERSONA_GENERAL }],
          },
        },
      })}\n`,
    )

    const res = await app.request(`http://localhost${CLI_API_PATHS.MARKET_INSTALLED}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { packages: Record<string, { version: string }> }
    expect(body.packages[BASIC_KIT_PACKAGE_ID]?.version).toBe('1.0.0')
  })

  it('POST /market/install 未配对时应返回 401', async () => {
    const { app } = await createTestApp()
    const res = await app.request(`http://localhost${CLI_API_PATHS.MARKET_INSTALL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: BASIC_KIT_PACKAGE_ID }),
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('device_not_paired')
  })

  it('POST /market/install 成功时应返回安装结果并推送 market_installed 事件', async () => {
    const { app, deps, tempHome } = await createTestApp()
    await writeFile(
      join(tempHome, 'config.json'),
      `${JSON.stringify({ version: 1, deviceToken: 'test-token', backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}` }, null, 2)}\n`,
    )
    deps.authState.deviceToken = 'test-token'

    const installSpy = vi.spyOn(marketInstaller, 'installMarketPackageFromBackend').mockResolvedValue({
      packageId: BASIC_KIT_PACKAGE_ID,
      version: '1.0.1',
      action: 'updated',
      assets: [{ type: 'persona', id: BUILTIN_PERSONA_GENERAL }],
    })

    const events: Array<{ type: string; packageId?: string }> = []
    const abort = new AbortController()
    deps.deviceEventHub.subscribe({
      id: 'test-market',
      signal: abort.signal,
      write: async event => {
        events.push(event)
      },
    })

    const res = await app.request(`http://localhost${CLI_API_PATHS.MARKET_INSTALL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ packageId: BASIC_KIT_PACKAGE_ID }),
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as { packageId: string; version: string; action: string }
    expect(body).toEqual({ packageId: BASIC_KIT_PACKAGE_ID, version: '1.0.1', action: 'updated' })
    expect(installSpy).toHaveBeenCalled()
    expect(events.some(e => e.type === 'market_installed' && e.packageId === BASIC_KIT_PACKAGE_ID)).toBe(true)

    abort.abort()
    installSpy.mockRestore()
  })

  it('POST /market/uninstall basic-kit 应返回 409', async () => {
    const { app } = await createTestApp()
    const uninstallSpy = vi
      .spyOn(marketInstaller, 'uninstallMarketPackage')
      .mockRejectedValue(new MarketInstallerError('basic_kit_uninstall_forbidden', 'museai/basic-kit 不可卸载'))

    const res = await app.request(`http://localhost${CLI_API_PATHS.MARKET_UNINSTALL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId: BASIC_KIT_PACKAGE_ID }),
    })
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('basic_kit_uninstall_forbidden')
    uninstallSpy.mockRestore()
  })

  it('POST /market/update 应调用 updateMarketPackage', async () => {
    const { app, deps, tempHome } = await createTestApp()
    await writeFile(
      join(tempHome, 'config.json'),
      `${JSON.stringify({ version: 1, deviceToken: 'test-token', backendUrl: `http://127.0.0.1:${DEFAULT_PORTS.SERVER}` }, null, 2)}\n`,
    )
    deps.authState.deviceToken = 'test-token'

    const updateSpy = vi.spyOn(marketInstaller, 'updateMarketPackage').mockResolvedValue({
      packageId: BASIC_KIT_PACKAGE_ID,
      version: '1.0.1',
      action: 'updated',
      assets: [{ type: 'persona', id: BUILTIN_PERSONA_GENERAL }],
    })

    const res = await app.request(`http://localhost${CLI_API_PATHS.MARKET_UPDATE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ packageId: BASIC_KIT_PACKAGE_ID }),
    })

    expect(res.status).toBe(200)
    expect(updateSpy).toHaveBeenCalledWith(expect.anything(), BASIC_KIT_PACKAGE_ID, expect.objectContaining({ deviceToken: 'test-token' }))
    updateSpy.mockRestore()
  })

  it('POST /agents 应创建带 activeToolNames 的 Agent', async () => {
    const { app } = await createTestApp()
    const res = await app.request('http://localhost/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '测试 Agent',
        personaId: BUILTIN_PERSONA_GENERAL,
        skillIds: [],
        activeToolNames: ['read', 'ls'],
      }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { agent: { name: string; activeToolNames: string[] } }
    expect(body.agent.name).toBe('测试 Agent')
    expect(body.agent.activeToolNames).toEqual(['read', 'ls'])
  })

  it('GET/PATCH /sessions/:id/settings 应读写会话设置', async () => {
    const { app } = await createTestApp()
    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: BUILTIN_GENERAL_AGENT_ID }),
    })
    const { session } = (await createRes.json()) as { session: { id: string } }

    const getRes = await app.request(`http://localhost/sessions/${session.id}/settings`)
    expect(getRes.status).toBe(200)
    const settings = (await getRes.json()) as { modelRef?: string; thinkingLevel: string }
    expect(settings.thinkingLevel).toBeTruthy()

    const patchRes = await app.request(`http://localhost/sessions/${session.id}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thinkingLevel: 'low', modelRef: 'openai/deepseek-v4-flash' }),
    })
    expect(patchRes.status).toBe(200)
    const patched = (await patchRes.json()) as { thinkingLevel: string }
    expect(patched.thinkingLevel).toBe('low')
  })

  it('GET /sessions/:id/tree 与 POST navigate/fork 应读写 session 树', async () => {
    const { app } = await createTestApp()
    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: BUILTIN_GENERAL_AGENT_ID, name: 'tree-demo' }),
    })
    const { session } = (await createRes.json()) as { session: { id: string } }

    const treeRes = await app.request(`http://localhost/sessions/${session.id}/tree`)
    expect(treeRes.status).toBe(200)
    const tree = (await treeRes.json()) as { sessionId: string; entries: unknown[]; branch: unknown[] }
    expect(tree.sessionId).toBe(session.id)

    const forkRes = await app.request(`http://localhost/sessions/${session.id}/fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'forked' }),
    })
    expect(forkRes.status).toBe(201)
    const forked = (await forkRes.json()) as { session: { id: string; name?: string } }
    expect(forked.session.id).not.toBe(session.id)
    expect(forked.session.name).toBe('forked')

    const navigateRes = await app.request(`http://localhost/sessions/${session.id}/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: null }),
    })
    expect(navigateRes.status).toBe(200)
  })
})

describe('ChatService', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
  })

  it('enqueue 未配对时应推送错误事件', async () => {
    const { deps } = await createTestApp()
    const session = await deps.sessionStore.create({ agentId: BUILTIN_CODING_AGENT_ID })
    const received: MuseSseEvent[] = []
    const abort = new AbortController()

    deps.eventHub.subscribe(
      session.id,
      createSseSubscriber(abort.signal, async event => {
        received.push(event)
      }),
    )

    await deps.chatService.enqueue({ sessionId: session.id, message: '你好', mode: 'prompt' })
    await new Promise(resolve => setTimeout(resolve, 100))

    const errorEvent = received.find(e => e.type === 'error')
    expect(errorEvent?.type === 'error' && errorEvent.message).toContain('未配对')
    expect(received.some(e => e.type === 'agent_end')).toBe(true)
  })

  it('LLM 返回 error stopReason 时应推送 error 事件', async () => {
    const { deps, tempHome } = await createTestApp()
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
      vi.fn(async (url: string | URL) => {
        if (String(url).includes('/v1/chat/completions')) {
          return new Response(JSON.stringify({ error: 'no_provider', message: '未配置 LLM Provider' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return new Response('not found', { status: 404 })
      }),
    )

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    const received: MuseSseEvent[] = []
    const abort = new AbortController()

    deps.eventHub.subscribe(
      session.id,
      createSseSubscriber(abort.signal, async event => {
        received.push(event)
      }),
    )

    await deps.chatService.enqueue({ sessionId: session.id, message: '你好', mode: 'prompt' })
    await new Promise(resolve => setTimeout(resolve, 1000))

    const errorEvent = received.find(e => e.type === 'error')
    expect(errorEvent?.type === 'error' && errorEvent.message).toContain('未配置 LLM Provider')
    expect(received.some(e => e.type === 'agent_end')).toBe(true)

    vi.unstubAllGlobals()
  })

  it('POST /sessions/:id/compact 在 idle 时应接受', async () => {
    const { app, deps } = await createTestApp()
    const compactSpy = vi.spyOn(deps.chatService, 'enqueueCompact').mockResolvedValue({ accepted: true })

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    const res = await app.request(`http://localhost/sessions/${session.id}/compact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customInstructions: '保留 API 设计细节' }),
    })

    expect(res.status).toBe(202)
    expect(compactSpy).toHaveBeenCalledWith(session.id, { customInstructions: '保留 API 设计细节' })
  })

  it('POST /sessions/:id/compact 在 busy 时应返回 409', async () => {
    const { app, deps } = await createTestApp()
    vi.spyOn(deps.chatService, 'isSessionBusy').mockReturnValue(true)

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    const res = await app.request(`http://localhost/sessions/${session.id}/compact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })

    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('session_busy')
  })

  it('POST /sessions/:id/abort 应调用 chatService.abortTurn', async () => {
    const { app, deps } = await createTestApp()
    const abortSpy = vi.spyOn(deps.chatService, 'abortTurn').mockResolvedValue({ aborted: true })

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    const res = await app.request(`http://localhost/sessions/${session.id}/abort`, { method: 'POST' })

    expect(res.status).toBe(202)
    expect(abortSpy).toHaveBeenCalledWith(session.id)
    const body = (await res.json()) as { aborted: boolean }
    expect(body.aborted).toBe(true)
  })

  it('POST /sessions/:id/abort 在 session 不存在时应返回 404', async () => {
    const { app } = await createTestApp()
    const res = await app.request('http://localhost/sessions/550e8400-e29b-41d4-a716-446655440000/abort', { method: 'POST' })
    expect(res.status).toBe(404)
  })
})
