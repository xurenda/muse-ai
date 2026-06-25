import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_AGENT_ID } from '@museai/shared'
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
    expect(tree.activeMessagePathIds.length).toBeGreaterThan(0)
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
    expect(navigated.activeMessagePathIds.includes(user2Id ?? '')).toBe(false)
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

  it('getTree 应过滤内部配置节点', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID })
    const piSession = await store.openPiSession(created.id)
    expect(piSession).toBeDefined()
    await piSession?.appendThinkingLevelChange('low')
    await piSession?.appendMessage({ role: 'user', content: '你好', timestamp: Date.now() })

    const tree = await store.getTree(created.id)
    expect(tree.entries.every(entry => entry.type === 'message' || entry.type === 'branch_summary')).toBe(true)
    expect(tree.entries.some(entry => entry.type === 'message' && entry.role === 'user')).toBe(true)
  })

  it('getTree branch 应包含 thinking 与 toolCalls', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID })
    const piSession = await store.openPiSession(created.id)
    await piSession?.appendMessage({ role: 'user', content: '列出文件', timestamp: Date.now() })
    await piSession?.appendMessage({
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: '需要 ls' },
        { type: 'toolCall', id: 'tc1', name: 'ls', arguments: { path: '.' } },
      ],
      api: 'openai',
      provider: 'openai',
      model: 'gpt-4',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: 'toolUse',
      timestamp: Date.now(),
    })
    await piSession?.appendMessage({
      role: 'toolResult',
      toolCallId: 'tc1',
      toolName: 'ls',
      content: [{ type: 'text', text: 'a.txt' }],
      isError: false,
      timestamp: Date.now(),
    })
    await piSession?.appendMessage({
      role: 'assistant',
      content: [{ type: 'text', text: '有 a.txt' }],
      api: 'openai',
      provider: 'openai',
      model: 'gpt-4',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: 'stop',
      timestamp: Date.now(),
    })

    const tree = await store.getTree(created.id)
    const assistant = tree.branch.find(message => message.role === 'assistant')
    expect(assistant?.thinking).toBe('需要 ls')
    expect(assistant?.text).toBe('有 a.txt')
    expect(assistant?.toolCalls?.[0]?.toolName).toBe('ls')
    expect(assistant?.toolCalls?.[0]?.result).toBe('a.txt')
  })

  it('navigate 到 tool loop 首轮 assistant 应展示合并后的正文', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID })
    const piSession = await store.openPiSession(created.id)
    await piSession?.appendMessage({ role: 'user', content: '列出文件', timestamp: Date.now() })
    const firstAssistantId = await piSession?.appendMessage({
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: '需要 ls' },
        { type: 'toolCall', id: 'tc1', name: 'ls', arguments: { path: '.' } },
      ],
      api: 'openai',
      provider: 'openai',
      model: 'gpt-4',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: 'toolUse',
      timestamp: Date.now(),
    })
    await piSession?.appendMessage({
      role: 'toolResult',
      toolCallId: 'tc1',
      toolName: 'ls',
      content: [{ type: 'text', text: 'a.txt' }],
      isError: false,
      timestamp: Date.now(),
    })
    await piSession?.appendMessage({
      role: 'assistant',
      content: [{ type: 'text', text: '有 a.txt' }],
      api: 'openai',
      provider: 'openai',
      model: 'gpt-4',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: 'stop',
      timestamp: Date.now(),
    })
    await piSession?.appendMessage({ role: 'user', content: '下一轮', timestamp: Date.now() + 1 })

    expect(firstAssistantId).toBeTruthy()
    const navigated = await store.navigate(created.id, firstAssistantId ?? null)
    const assistant = navigated.branch.find(message => message.role === 'assistant')
    expect(assistant?.text).toBe('有 a.txt')
    expect(assistant?.thinking).toBe('需要 ls')
    expect(navigated.branch.some(message => message.text.includes('下一轮'))).toBe(false)
  })

  it('leaf 落在 thinking_level_change 时应回退到对话 tip 并展示完整 branch', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID })
    const piSession = await store.openPiSession(created.id)
    expect(piSession).toBeDefined()

    await piSession?.appendMessage({ role: 'user', content: '第一轮', timestamp: Date.now() })
    await piSession?.appendMessage({
      role: 'assistant',
      content: [{ type: 'text', text: '回复一' }],
      api: 'openai',
      provider: 'openai',
      model: 'gpt-4',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: 'stop',
      timestamp: Date.now(),
    })
    const staleThinkingId = await piSession?.appendThinkingLevelChange('low')
    await piSession?.appendMessage({ role: 'user', content: '第二轮', timestamp: Date.now() + 1 })
    await piSession?.appendMessage({
      role: 'assistant',
      content: [{ type: 'text', text: '回复二' }],
      api: 'openai',
      provider: 'openai',
      model: 'gpt-4',
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: 'stop',
      timestamp: Date.now() + 2,
    })

    if (staleThinkingId) {
      await piSession?.moveTo(staleThinkingId)
    }

    const tree = await store.getTree(created.id)
    expect(tree.branch.some(message => message.text.includes('第一轮'))).toBe(true)
    expect(tree.branch.some(message => message.text.includes('第二轮'))).toBe(true)
    expect(tree.branch.some(message => message.text.includes('回复二'))).toBe(true)
    expect(tree.entries.some(entry => entry.type === 'message' && entry.preview.includes('第二轮'))).toBe(true)
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
