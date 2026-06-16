import { MuseHarness, mapHarnessEventToSse, buildHarnessOptionsForSession, type MuseAgentRegistry, type MuseSessionStore } from '@muse-ai/core'
import type { ChatRequest, MuseSseEvent } from '@muse-ai/shared'
import { createBackendGetApiKeyAndHeaders, withProxyBaseUrl, type BackendLlmAuthConfig } from '../backend/llm-auth.js'
import { resolveActiveTools } from '@/tools/index.js'
import type { SessionEventHub } from './event-hub.js'
import type { SessionTitleService } from './session-title-service.js'

function formatDispatchError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** 接通 MuseHarness + Backend LLM 代理 */
export class ChatService {
  private readonly sessionChains = new Map<string, Promise<void>>()

  constructor(
    private readonly sessionStore: MuseSessionStore,
    private readonly eventHub: SessionEventHub,
    private readonly sessionTitleService: SessionTitleService,
    private readonly agentRegistry: MuseAgentRegistry,
    private readonly cwd: string,
    private readonly resolveBackendAuth: () => Promise<BackendLlmAuthConfig | undefined>,
  ) {}

  async enqueue(request: ChatRequest): Promise<{ accepted: true }> {
    const session = await this.sessionStore.get(request.sessionId)
    if (!session) {
      throw new ChatServiceError('session_not_found', `Session 不存在: ${request.sessionId}`)
    }

    const updatedMeta = await this.sessionStore.setNameFromFirstMessageIfEmpty(request.sessionId, request.message)
    if (updatedMeta?.name && updatedMeta.nameSource === 'first_message') {
      await this.sessionTitleService.publishMetaUpdate(updatedMeta)
    }
    await this.sessionStore.touch(request.sessionId)
    const previous = this.sessionChains.get(request.sessionId) ?? Promise.resolve()
    const next = previous
      .then(() => this.dispatchTurn(request, session.agentId))
      .catch(async (error: unknown) => {
        await this.eventHub.publish(request.sessionId, {
          type: 'error',
          message: formatDispatchError(error),
        })
      })
    this.sessionChains.set(request.sessionId, next)
    void next.finally(() => {
      if (this.sessionChains.get(request.sessionId) === next) {
        this.sessionChains.delete(request.sessionId)
      }
    })
    return { accepted: true }
  }

  /** 该 Session 是否仍有排队或进行中的对话任务 */
  isSessionBusy(sessionId: string): boolean {
    return this.sessionChains.has(sessionId)
  }

  private async dispatchTurn(request: ChatRequest, agentId: string): Promise<void> {
    const { sessionId, message, mode } = request
    const backendAuth = await this.resolveBackendAuth()

    if (!backendAuth?.deviceToken) {
      await this.publishError(sessionId, '未配对 CLI 设备：请先执行 muse pair <配对码>，或在 Web 设置页生成配对码')
      return
    }

    const piSession = await this.sessionStore.openPiSession(sessionId)
    if (!piSession) {
      throw new ChatServiceError('session_not_found', `Session 不存在: ${sessionId}`)
    }

    const context = await this.agentRegistry.resolveRuntimeContext(agentId)
    const harnessOptions = await buildHarnessOptionsForSession(this.agentRegistry, agentId, piSession, this.cwd)
    const tools = resolveActiveTools(context.agent.activeToolNames, this.cwd)
    const model = withProxyBaseUrl(harnessOptions.model, backendAuth.backendUrl)

    const harness = new MuseHarness({
      ...harnessOptions,
      tools,
      model,
      getApiKeyAndHeaders: createBackendGetApiKeyAndHeaders(backendAuth),
    })

    const events: MuseSseEvent[] = []
    const unsubscribe = harness.subscribe(async event => {
      const mapped = mapHarnessEventToSse(event)
      if (mapped) {
        events.push(mapped)
        await this.eventHub.publish(sessionId, mapped)
      }
    })

    try {
      await this.dispatchMessage(harness, message, mode)
      await this.sessionStore.touch(sessionId)
      void this.sessionTitleService.maybeGenerateAfterTurn(sessionId).catch(() => {})
    } catch (error: unknown) {
      const text = formatDispatchError(error)
      const friendly =
        text.includes('no_provider') || text.includes('未配置 LLM Provider')
          ? '未配置 LLM Provider：请先在 Web 设置页添加 OpenAI 兼容 Provider 并设为默认'
          : text
      await this.publishError(sessionId, friendly)
    } finally {
      unsubscribe()
    }
  }

  /**
   * REST 每轮新建 Harness（idle），steer/follow_up 仅适用于常驻 runtime 内打断。
   * Web 侧在 Agent 未 streaming 时不应选 steer/follow_up，此处 idle 时回落 prompt。
   */
  private async dispatchMessage(harness: MuseHarness, message: string, mode: ChatRequest['mode']): Promise<void> {
    if (mode === 'prompt') {
      await harness.prompt(message)
      return
    }
    await harness.prompt(message)
  }

  private async publishError(sessionId: string, message: string): Promise<void> {
    await this.eventHub.publish(sessionId, { type: 'error', message })
    await this.eventHub.publish(sessionId, { type: 'agent_end' })
  }
}

export class ChatServiceError extends Error {
  constructor(
    readonly code: 'session_not_found' | 'agent_not_found' | 'invalid_request',
    message: string,
  ) {
    super(message)
    this.name = 'ChatServiceError'
  }
}
