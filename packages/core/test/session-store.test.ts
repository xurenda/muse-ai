import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_AGENT_ID } from '@museai/shared'
import { MuseSessionStore } from '../src/session-store.js'

describe('MuseSessionStore', () => {
  let tempRoot: string

  afterEach(() => {
    delete process.env.MUSE_HOME
  })

  async function createStore(): Promise<MuseSessionStore> {
    tempRoot = await mkdtemp(join(tmpdir(), 'muse-core-session-'))
    const sessionsRoot = join(tempRoot, 'sessions')
    return new MuseSessionStore({
      sessionsRoot,
      registryPath: join(sessionsRoot, 'registry.json'),
      cwd: tempRoot,
    })
  }

  it('应创建 JSONL session 并写入 registry', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID, name: '测试' })

    expect(created.agentId).toBe(DEFAULT_AGENT_ID)
    expect(created.name).toBe('测试')

    const listed = await store.list()
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(created.id)
  })

  it('create 应写入初始 modelSelection', async () => {
    const store = await createStore()
    const created = await store.create({
      agentId: DEFAULT_AGENT_ID,
      modelSelection: { type: 'tier', tier: 'medium' },
    })

    expect(created.modelSelection).toEqual({ type: 'tier', tier: 'medium' })

    const loaded = await store.get(created.id)
    expect(loaded?.modelSelection).toEqual({ type: 'tier', tier: 'medium' })
  })

  it('重启后应能从 registry 恢复元数据并打开 JSONL', async () => {
    const store1 = await createStore()
    const created = await store1.create({ agentId: DEFAULT_AGENT_ID })

    const store2 = new MuseSessionStore({
      sessionsRoot: join(tempRoot, 'sessions'),
      registryPath: join(tempRoot, 'sessions', 'registry.json'),
      cwd: tempRoot,
    })

    const restored = await store2.get(created.id)
    expect(restored?.id).toBe(created.id)

    const piSession = await store2.openPiSession(created.id)
    expect(piSession).toBeDefined()
    const metadata = await piSession?.getMetadata()
    expect(metadata?.id).toBe(created.id)
  })

  it('touch 应更新 updatedAt', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID })

    await new Promise(resolve => setTimeout(resolve, 5))
    const touched = await store.touch(created.id)
    expect(touched?.updatedAt).not.toBe(created.updatedAt)
  })

  it('首条消息应写入临时标题', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID })

    const updated = await store.setNameFromFirstMessageIfEmpty(created.id, '  帮我写个脚本  ')
    expect(updated?.name).toBe('帮我写个脚本')
    expect(updated?.nameSource).toBe('first_message')
  })

  it('manual 标题不应被首条消息覆盖', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID, name: '固定标题' })

    const updated = await store.setNameFromFirstMessageIfEmpty(created.id, '新的消息')
    expect(updated?.name).toBe('固定标题')
    expect(updated?.nameSource).toBe('manual')
  })

  it('updateName 应写入 manual 来源', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID })

    const updated = await store.updateName(created.id, '自定义标题')
    expect(updated?.name).toBe('自定义标题')
    expect(updated?.nameSource).toBe('manual')
  })

  it('delete 应移除 registry 与 JSONL', async () => {
    const store = await createStore()
    const created = await store.create({ agentId: DEFAULT_AGENT_ID })
    expect(await store.delete(created.id)).toBe(true)
    expect(await store.get(created.id)).toBeUndefined()
    expect(await store.openPiSession(created.id)).toBeUndefined()
  })
})
