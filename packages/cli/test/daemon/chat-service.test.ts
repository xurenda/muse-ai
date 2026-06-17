import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AssistantMessage } from '@earendil-works/pi-ai'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MuseHarness } from '@muse-ai/core'
import { BUILTIN_GENERAL_AGENT_ID, DEFAULT_PORTS } from '@muse-ai/shared'
import { createCliDaemonDeps } from '@/daemon/deps.js'

async function createPairedDeps() {
  const tempHome = await mkdtemp(join(tmpdir(), 'muse-chat-service-'))
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

function mockAssistantMessage(): AssistantMessage {
  return {
    role: 'assistant',
    content: [{ type: 'text', text: 'ok' }],
    stopReason: 'end_turn',
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  } as AssistantMessage
}

describe('ChatService steer / follow_up', () => {
  afterEach(() => {
    delete process.env.MUSE_HOME
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('prompt 模式应调用 harness.prompt', async () => {
    const { deps } = await createPairedDeps()
    const promptSpy = vi.spyOn(MuseHarness.prototype, 'prompt').mockResolvedValue(mockAssistantMessage())
    vi.spyOn(MuseHarness.prototype, 'subscribe').mockImplementation(() => () => {})

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    await deps.chatService.enqueue({ sessionId: session.id, message: '你好', mode: 'prompt' })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(promptSpy).toHaveBeenCalledWith('你好')
  })

  it('Agent streaming 时 steer 应调用 harness.steer', async () => {
    const { deps } = await createPairedDeps()
    let releasePrompt!: () => void
    const promptGate = new Promise<void>(resolve => {
      releasePrompt = resolve
    })

    vi.spyOn(MuseHarness.prototype, 'prompt').mockImplementation(async () => {
      await promptGate
      return mockAssistantMessage()
    })
    const steerSpy = vi.spyOn(MuseHarness.prototype, 'steer').mockResolvedValue(undefined)
    vi.spyOn(MuseHarness.prototype, 'subscribe').mockImplementation(() => () => {})

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    void deps.chatService.enqueue({ sessionId: session.id, message: '开始', mode: 'prompt' })
    await new Promise(resolve => setTimeout(resolve, 50))

    await deps.chatService.enqueue({ sessionId: session.id, message: '改方向', mode: 'steer' })
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(steerSpy).toHaveBeenCalledWith('改方向')

    releasePrompt()
    await new Promise(resolve => setTimeout(resolve, 50))
  })

  it('Agent streaming 时 follow_up 应调用 harness.followUp', async () => {
    const { deps } = await createPairedDeps()
    let releasePrompt!: () => void
    const promptGate = new Promise<void>(resolve => {
      releasePrompt = resolve
    })

    vi.spyOn(MuseHarness.prototype, 'prompt').mockImplementation(async () => {
      await promptGate
      return mockAssistantMessage()
    })
    const followUpSpy = vi.spyOn(MuseHarness.prototype, 'followUp').mockResolvedValue(undefined)
    vi.spyOn(MuseHarness.prototype, 'subscribe').mockImplementation(() => () => {})

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    void deps.chatService.enqueue({ sessionId: session.id, message: '开始', mode: 'prompt' })
    await new Promise(resolve => setTimeout(resolve, 50))

    await deps.chatService.enqueue({ sessionId: session.id, message: '排队下一条', mode: 'follow_up' })
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(followUpSpy).toHaveBeenCalledWith('排队下一条')

    releasePrompt()
    await new Promise(resolve => setTimeout(resolve, 50))
  })

  it('idle 时 steer 应回落为 prompt', async () => {
    const { deps } = await createPairedDeps()
    const promptSpy = vi.spyOn(MuseHarness.prototype, 'prompt').mockResolvedValue(mockAssistantMessage())
    const steerSpy = vi.spyOn(MuseHarness.prototype, 'steer').mockResolvedValue(undefined)
    vi.spyOn(MuseHarness.prototype, 'subscribe').mockImplementation(() => () => {})

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    await deps.chatService.enqueue({ sessionId: session.id, message: 'idle steer', mode: 'steer' })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(steerSpy).not.toHaveBeenCalled()
    expect(promptSpy).toHaveBeenCalledWith('idle steer')
  })

  it('prompt turn 结束后应释放 runtime', async () => {
    const { deps } = await createPairedDeps()
    const unsubscribe = vi.fn()
    vi.spyOn(MuseHarness.prototype, 'prompt').mockResolvedValue(mockAssistantMessage())
    vi.spyOn(MuseHarness.prototype, 'subscribe').mockImplementation(() => unsubscribe)

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    await deps.chatService.enqueue({ sessionId: session.id, message: '你好', mode: 'prompt' })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(unsubscribe).toHaveBeenCalled()
    expect(deps.chatService.isSessionBusy(session.id)).toBe(false)
  })

  it('进行中的 turn 可被 evictRuntime 强制释放', async () => {
    const { deps } = await createPairedDeps()
    let releasePrompt!: () => void
    const promptGate = new Promise<void>(resolve => {
      releasePrompt = resolve
    })
    const unsubscribe = vi.fn()
    vi.spyOn(MuseHarness.prototype, 'prompt').mockImplementation(async () => {
      await promptGate
      return mockAssistantMessage()
    })
    vi.spyOn(MuseHarness.prototype, 'subscribe').mockImplementation(() => unsubscribe)

    const session = await deps.sessionStore.create({ agentId: BUILTIN_GENERAL_AGENT_ID })
    void deps.chatService.enqueue({ sessionId: session.id, message: '你好', mode: 'prompt' })
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(deps.chatService.isSessionBusy(session.id)).toBe(true)
    deps.chatService.evictRuntime(session.id)
    expect(unsubscribe).toHaveBeenCalled()
    // activeTurn 已释放，但 sessionChains 仍等待 prompt promise 结束
    expect(deps.chatService.isSessionBusy(session.id)).toBe(true)

    releasePrompt()
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(deps.chatService.isSessionBusy(session.id)).toBe(false)
  })
})
