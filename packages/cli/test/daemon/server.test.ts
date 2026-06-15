import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { MuseSseEvent } from '@muse-ai/shared'
import { DEFAULT_AGENT_ID, sessionEventsPath } from '@muse-ai/shared'
import { loadCliConfig } from '@/config.js'
import { ChatService } from '@/daemon/chat-service.js'
import { createCliDaemonDeps } from '@/daemon/deps.js'
import { createSseSubscriber } from '@/daemon/event-hub.js'
import { createCliApp } from '@/daemon/server.js'

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
  }
  const deps = createCliDaemonDeps({ musePaths, cwd: tempHome })
  const app = createCliApp(loadCliConfig({}), deps)
  return { app, deps, tempHome }
}

describe('loadCliConfig', () => {
  it('应使用默认端口 7421', () => {
    const config = loadCliConfig({})
    expect(config.port).toBe(7421)
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

  it('POST /sessions 与 GET /sessions 应持久化元数据', async () => {
    const { app } = await createTestApp()

    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: DEFAULT_AGENT_ID, name: 'demo' }),
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

  it('GET /sessions/:id/events 应返回 event-stream', async () => {
    const { app } = await createTestApp()

    const createRes = await app.request('http://localhost/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: DEFAULT_AGENT_ID }),
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
      body: JSON.stringify({ agentId: DEFAULT_AGENT_ID }),
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
  })
})

describe('ChatService', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
  })

  it('enqueue 应向 EventHub 推送占位事件', async () => {
    const { deps } = await createTestApp()
    const session = await deps.sessionStore.create({ agentId: DEFAULT_AGENT_ID })
    const received: MuseSseEvent[] = []
    const abort = new AbortController()

    deps.eventHub.subscribe(
      session.id,
      createSseSubscriber(abort.signal, async event => {
        received.push(event)
      }),
    )

    const chatService = new ChatService(deps.sessionStore, deps.eventHub)
    await chatService.enqueue({ sessionId: session.id, message: '你好', mode: 'prompt' })
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(received.some(e => e.type === 'text_delta')).toBe(true)
    expect(received.some(e => e.type === 'agent_end')).toBe(true)
  })
})
