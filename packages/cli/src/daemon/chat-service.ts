import {
  MuseHarness,
  mapHarnessEventToSse,
  buildHarnessOptionsForSession,
  extractAssistantTurnError,
  formatLlmErrorMessage,
  type MuseAgentRegistry,
  type MuseSessionStore,
} from '@muse-ai/core'
import type { ChatRequest } from '@muse-ai/shared'
import { createBackendGetApiKeyAndHeaders, withProxyBaseUrl, type BackendLlmAuthConfig } from '../backend/llm-auth.js'
import { resolveActiveTools } from '@/tools/index.js'
import type { SessionEventHub } from './event-hub.js'
import type { SessionTitleService } from './session-title-service.js'

function formatDispatchError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

/** 单次 prompt turn 进行中的 Harness 与事件订阅（turn 结束即释放） */
interface ActiveTurnRuntime {
  harness: MuseHarness
  unsubscribeEvents: () => void
}

/** 接通 MuseHarness + Backend LLM 代理 */
export class ChatService {
  private readonly sessionChains = new Map<string, Promise<void>>()
  /** 仅在有进行中的 turn 时持有；steer/follow_up 依赖此实例 */
  private readonly activeTurns = new Map<string, ActiveTurnRuntime>()

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

    if (request.mode === 'steer' || request.mode === 'follow_up') {
      void this.handleSteerOrFollowUp(request, session.agentId).catch(async (error: unknown) => {
        await this.publishError(request.sessionId, formatDispatchError(error))
      })
      return { accepted: true }
    }

    this.schedulePromptTurn(request, session.agentId)
    return { accepted: true }
  }

  /** 该 Session 是否仍有排队或进行中的对话任务 */
  isSessionBusy(sessionId: string): boolean {
    if (this.sessionChains.has(sessionId)) return true
    return this.activeTurns.has(sessionId)
  }

  /** Session 删除或 turn 结束时释放 Harness */
  evictRuntime(sessionId: string): void {
    const runtime = this.activeTurns.get(sessionId)
    if (!runtime) return
    runtime.unsubscribeEvents()
    this.activeTurns.delete(sessionId)
  }

  private schedulePromptTurn(request: ChatRequest, agentId: string): void {
    const previous = this.sessionChains.get(request.sessionId) ?? Promise.resolve()
    const next = previous
      .then(() => this.dispatchTurn(request, agentId))
      .catch(async (error: unknown) => {
        await this.publishError(request.sessionId, formatDispatchError(error))
      })
    this.sessionChains.set(request.sessionId, next)
    void next.finally(() => {
      if (this.sessionChains.get(request.sessionId) === next) {
        this.sessionChains.delete(request.sessionId)
      }
    })
  }

  private async handleSteerOrFollowUp(request: ChatRequest, agentId: string): Promise<void> {
    const runtime = this.activeTurns.get(request.sessionId)
    if (!runtime) {
      console.warn(`[ChatService] ${request.mode} 在 idle 时收到（session=${request.sessionId}），回落为 prompt`)
      this.schedulePromptTurn({ ...request, mode: 'prompt' }, agentId)
      return
    }

    try {
      if (request.mode === 'steer') {
        await runtime.harness.steer(request.message)
      } else {
        await runtime.harness.followUp(request.message)
      }
    } catch (error: unknown) {
      await this.publishError(request.sessionId, formatLlmErrorMessage(formatDispatchError(error)))
    }
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

    const runtime = await this.createTurnRuntime(sessionId, agentId, piSession, backendAuth)
    this.activeTurns.set(sessionId, runtime)

    try {
      const assistantMessage = await this.dispatchMessage(runtime.harness, message, mode)
      if (assistantMessage) {
        const turnError = extractAssistantTurnError(assistantMessage)
        if (turnError) {
          await this.eventHub.publish(sessionId, { type: 'error', message: turnError })
        }
      }
      await this.sessionStore.touch(sessionId)
      void this.sessionTitleService.maybeGenerateAfterTurn(sessionId).catch(() => {})
    } catch (error: unknown) {
      await this.publishError(sessionId, formatLlmErrorMessage(formatDispatchError(error)))
    } finally {
      this.evictRuntime(sessionId)
    }
  }

  private async createTurnRuntime(
    sessionId: string,
    agentId: string,
    piSession: NonNullable<Awaited<ReturnType<MuseSessionStore['openPiSession']>>>,
    backendAuth: BackendLlmAuthConfig,
  ): Promise<ActiveTurnRuntime> {
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

    const unsubscribeEvents = harness.subscribe(async event => {
      const mapped = mapHarnessEventToSse(event)
      if (mapped) {
        await this.eventHub.publish(sessionId, mapped)
      }
    })

    return { harness, unsubscribeEvents }
  }

  private async dispatchMessage(
    harness: MuseHarness,
    message: string,
    mode: ChatRequest['mode'],
  ): Promise<Awaited<ReturnType<MuseHarness['prompt']>> | undefined> {
    switch (mode) {
      case 'steer':
        await harness.steer(message)
        return undefined
      case 'follow_up':
        await harness.followUp(message)
        return undefined
      case 'prompt':
      default:
        return harness.prompt(message)
    }
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
