import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_AGENT_ID } from '@muse-ai/shared'
import { MuseSessionStore } from '../src/session-store.js'
import { mapSessionTreeEntry } from '../src/session-tree.js'

describe('session-tree', () => {
  let tempRoot: string

  afterEach(() => {
    delete process.env.MUSE_HOME
  })

  async function createStore(): Promise<MuseSessionStore> {
    tempRoot = await mkdtemp(join(tmpdir(), 'muse-core-tree-'))
    const sessionsRoot = join(tempRoot, 'sessions')
    return new MuseSessionStore({
      sessionsRoot,
      registryPath: join(sessionsRoot, 'registry.json'),
      cwd: tempRoot,
    })
  }

  it('getTree 应返回 leaf 与分支消息', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID })
    const piSession = await store.openPiSession(created.id)
    expect(piSession).toBeDefined()
    await piSession?.appendMessage({ role: 'user', content: '你好', timestamp: Date.now() })
    await piSession?.appendMessage({
      role: 'assistant',
      content: [{ type: 'text', text: '你好！' }],
      provider: 'openai',
      model: 'gpt-4',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      stopReason: 'stop',
      timestamp: Date.now(),
    })

    const tree = await store.getTree(created.id)
    expect(tree.leafId).toBeTruthy()
    expect(tree.entries.some(entry => entry.type === 'message')).toBe(true)
    expect(tree.branch).toHaveLength(2)
    expect(tree.branch[0]?.role).toBe('user')
  })

  it('navigate 应切换 leaf 并更新分支消息', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID })
    const piSession = await store.openPiSession(created.id)
    await piSession?.appendMessage({ role: 'user', content: '第一条', timestamp: Date.now() })
    await piSession?.appendMessage({
      role: 'assistant',
      content: [{ type: 'text', text: '回复一' }],
      provider: 'openai',
      model: 'gpt-4',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      stopReason: 'stop',
      timestamp: Date.now(),
    })
    const user2Id = await piSession?.appendMessage({ role: 'user', content: '第二条', timestamp: Date.now() })

    const navigated = await store.navigate(created.id, user2Id ?? null)
    expect(navigated.branch.some(message => message.text.includes('第二条'))).toBe(false)
    expect(navigated.branch.some(message => message.text.includes('第一条'))).toBe(true)
  })

  it('fork 应创建新 session 并继承 agentId', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID, name: '源会话' })
    const piSession = await store.openPiSession(created.id)
    await piSession?.appendMessage({ role: 'user', content: 'fork 前', timestamp: Date.now() })

    const forked = await store.fork(created.id, { name: '分叉会话' })
    expect(forked.id).not.toBe(created.id)
    expect(forked.agentId).toBe(DEFAULT_AGENT_ID)
    expect(forked.name).toBe('分叉会话')

    const forkTree = await store.getTree(forked.id)
    expect(forkTree.branch.some(message => message.text.includes('fork 前'))).toBe(true)
  })

  it('mapSessionTreeEntry 应生成 message preview', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID })
    const piSession = await store.openPiSession(created.id)
    await piSession?.appendMessage({ role: 'user', content: 'preview 测试', timestamp: Date.now() })
    const entries = await piSession!.getEntries()
    const messageEntry = entries.find(entry => entry.type === 'message')
    expect(messageEntry).toBeDefined()
    const mapped = mapSessionTreeEntry(messageEntry!)
    expect(mapped.type).toBe('message')
    if (mapped.type === 'message') {
      expect(mapped.preview).toContain('preview')
    }
  })
})
