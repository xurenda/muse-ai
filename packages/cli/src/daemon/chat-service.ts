import {
  MuseHarness,
  mapHarnessEventToSse,
  buildHarnessOptionsForSession,
  extractAssistantTurnError,
  formatLlmErrorMessage,
  isAssistantContextOverflow,
  type MuseAgentRegistry,
  type MuseSessionStore,
} from '@muse-ai/core'
import type { ChatRequest, CompactionReason, MuseLlmTask } from '@muse-ai/shared'
import { createBackendGetApiKeyAndHeaders, type BackendLlmAuthConfig } from '../backend/llm-auth.js'
import { runWithMuseProxyContext } from '../backend/muse-proxy-context.js'
import { createMuseProxyModel } from '../backend/muse-proxy-model.js'
import { resolveActiveTools } from '@/tools/index.js'
import type { SessionEventHub } from './event-hub.js'
import type { SessionTitleService } from './session-title-service.js'

const OVERFLOW_COMPACTED_HINT = '上下文已满，已自动压缩。请重新发送您的消息。'

function formatDispatchError(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

type PiSession = NonNullable<Awaited<ReturnType<MuseSessionStore['openPiSession']>>>

/** 单次 prompt turn 进行中的 Harness 与事件订阅（turn 结束即释放） */
interface ActiveHarnessRuntime {
  harness: MuseHarness
  unsubscribeEvents: () => void
}

/** 接通 MuseHarness + Backend LLM 代理 */
export class ChatService {
  private readonly sessionChains = new Map<string, Promise<void>>()
  /** 仅在有进行中的 turn 时持有；steer/follow_up 依赖此实例 */
  private readonly activeTurns = new Map<string, ActiveHarnessRuntime>()
  /** compact 进行中可 abort 的 harness */
  private readonly activeCompacts = new Map<string, ActiveHarnessRuntime>()
  /** compact 进行中（与 turn 互斥） */
  private readonly compactingSessions = new Set<string>()
  /** 用户请求 abort compact（用于 compaction_end.cancelled） */
  private readonly compactAbortRequested = new Set<string>()

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

  async enqueueCompact(sessionId: string, options?: { customInstructions?: string }): Promise<{ accepted: true }> {
    const session = await this.sessionStore.get(sessionId)
    if (!session) {
      throw new ChatServiceError('session_not_found', `Session 不存在: ${sessionId}`)
    }
    if (this.isSessionBusy(sessionId)) {
      throw new ChatServiceError('session_busy', 'Session 正在对话或压缩中，请稍后再试')
    }

    const previous = this.sessionChains.get(sessionId) ?? Promise.resolve()
    const next = previous
      .then(async () => {
        const backendAuth = await this.resolveBackendAuth()
        if (!backendAuth?.deviceToken) {
          await this.publishCompactionEnd(sessionId, {
            reason: 'manual',
            success: false,
            errorMessage: '未配对 CLI 设备：请先执行 muse pair <配对码>，或在 Web 设置页生成配对码',
          })
          return
        }

        const piSession = await this.sessionStore.openPiSession(sessionId)
        if (!piSession) {
          throw new ChatServiceError('session_not_found', `Session 不存在: ${sessionId}`)
        }

        await this.runCompact(sessionId, session.agentId, piSession, backendAuth, {
          reason: 'manual',
          customInstructions: options?.customInstructions,
        })
      })
      .catch(async (error: unknown) => {
        if (error instanceof ChatServiceError) throw error
        await this.publishCompactionEnd(sessionId, {
          reason: 'manual',
          success: false,
          errorMessage: formatLlmErrorMessage(formatDispatchError(error)),
        })
      })

    this.sessionChains.set(sessionId, next)
    void next.finally(() => {
      if (this.sessionChains.get(sessionId) === next) {
        this.sessionChains.delete(sessionId)
      }
    })

    return { accepted: true }
  }

  /** 该 Session 是否仍有排队或进行中的对话 / 压缩任务 */
  isSessionBusy(sessionId: string): boolean {
    if (this.compactingSessions.has(sessionId)) return true
    if (this.sessionChains.has(sessionId)) return true
    return this.activeTurns.has(sessionId)
  }

  /** 中断当前进行中的 turn 或 compact（无进行中的任务时返回 aborted: false） */
  async abortTurn(sessionId: string): Promise<{ aborted: boolean }> {
    const turnRuntime = this.activeTurns.get(sessionId)
    if (turnRuntime) {
      await turnRuntime.harness.abort()
      return { aborted: true }
    }

    const compactRuntime = this.activeCompacts.get(sessionId)
    if (compactRuntime) {
      this.compactAbortRequested.add(sessionId)
      await compactRuntime.harness.abort()
      return { aborted: true }
    }

    return { aborted: false }
  }

  /** Session 删除或 turn 结束时释放 Harness */
  evictRuntime(sessionId: string): void {
    const turnRuntime = this.activeTurns.get(sessionId)
    if (turnRuntime) {
      turnRuntime.unsubscribeEvents()
      this.activeTurns.delete(sessionId)
    }
    const compactRuntime = this.activeCompacts.get(sessionId)
    if (compactRuntime) {
      compactRuntime.unsubscribeEvents()
      this.activeCompacts.delete(sessionId)
      this.compactingSessions.delete(sessionId)
      this.compactAbortRequested.delete(sessionId)
    }
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

  private async dispatchTurn(request: ChatRequest, agentId: string, overflowCompactAttempted = false): Promise<void> {
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
      await runWithMuseProxyContext({ sessionId, task: 'chat', eventHub: this.eventHub, sessionStore: this.sessionStore }, async () => {
        const assistantMessage = mode === 'prompt' ? await runtime.harness.prompt(message) : undefined

        if (assistantMessage && mode === 'prompt') {
          const model = runtime.harness.getModel()
          if (!overflowCompactAttempted && isAssistantContextOverflow(assistantMessage, model.contextWindow)) {
            this.evictRuntime(sessionId)
            const compacted = await this.runCompact(sessionId, agentId, piSession, backendAuth, { reason: 'overflow' })
            if (compacted) {
              await this.publishError(sessionId, OVERFLOW_COMPACTED_HINT)
              return
            }
          }
        }

        if (assistantMessage) {
          const turnError = extractAssistantTurnError(assistantMessage)
          if (turnError) {
            await this.eventHub.publish(sessionId, { type: 'error', message: turnError })
          }
        }
      })

      await this.sessionStore.touch(sessionId)
      void this.sessionTitleService.maybeGenerateAfterTurn(sessionId).catch(() => {})
    } catch (error: unknown) {
      await this.publishError(sessionId, formatLlmErrorMessage(formatDispatchError(error)))
    } finally {
      if (this.activeTurns.has(sessionId)) {
        this.evictRuntime(sessionId)
      }
    }
  }

  private async runCompact(
    sessionId: string,
    agentId: string,
    piSession: PiSession,
    backendAuth: BackendLlmAuthConfig,
    options: { reason: CompactionReason; customInstructions?: string },
  ): Promise<boolean> {
    this.compactingSessions.add(sessionId)
    await this.eventHub.publish(sessionId, { type: 'compaction_start', reason: options.reason })

    const runtime = await this.createHarnessWithEvents(sessionId, agentId, piSession, backendAuth, 'compaction')
    this.activeCompacts.set(sessionId, runtime)

    try {
      const result = await runWithMuseProxyContext({ sessionId, task: 'compaction', eventHub: this.eventHub, sessionStore: this.sessionStore }, () =>
        runtime.harness.compact(options.customInstructions),
      )
      const compactionCount = await this.countCompactionEntries(piSession)
      await this.publishCompactionEnd(sessionId, {
        reason: options.reason,
        success: true,
        tokensBefore: result.tokensBefore,
        compactionCount,
      })
      await this.sessionStore.touch(sessionId)
      return true
    } catch (error: unknown) {
      const cancelled = this.compactAbortRequested.has(sessionId)
      await this.publishCompactionEnd(sessionId, {
        reason: options.reason,
        success: false,
        cancelled,
        errorMessage: cancelled ? undefined : formatLlmErrorMessage(formatDispatchError(error)),
      })
      return false
    } finally {
      runtime.unsubscribeEvents()
      this.activeCompacts.delete(sessionId)
      this.compactingSessions.delete(sessionId)
      this.compactAbortRequested.delete(sessionId)
    }
  }

  private async countCompactionEntries(piSession: PiSession): Promise<number> {
    const branch = await piSession.getBranch()
    return branch.filter(entry => entry.type === 'compaction').length
  }

  private async publishCompactionEnd(
    sessionId: string,
    payload: {
      reason: CompactionReason
      success: boolean
      tokensBefore?: number
      compactionCount?: number
      willRetry?: boolean
      cancelled?: boolean
      errorMessage?: string
    },
  ): Promise<void> {
    await this.eventHub.publish(sessionId, {
      type: 'compaction_end',
      reason: payload.reason,
      success: payload.success,
      tokensBefore: payload.tokensBefore,
      compactionCount: payload.compactionCount,
      willRetry: payload.willRetry,
      cancelled: payload.cancelled,
      errorMessage: payload.errorMessage,
    })
  }

  private async createTurnRuntime(sessionId: string, agentId: string, piSession: PiSession, backendAuth: BackendLlmAuthConfig): Promise<ActiveHarnessRuntime> {
    return this.createHarnessWithEvents(sessionId, agentId, piSession, backendAuth, 'chat')
  }

  private async createHarnessWithEvents(
    sessionId: string,
    agentId: string,
    piSession: PiSession,
    backendAuth: BackendLlmAuthConfig,
    task: MuseLlmTask,
  ): Promise<ActiveHarnessRuntime> {
    const meta = await this.sessionStore.get(sessionId)
    const harness = new MuseHarness({
      ...(await buildHarnessOptionsForSession(this.agentRegistry, agentId, piSession, this.cwd)),
      tools: resolveActiveTools((await this.agentRegistry.resolveRuntimeContext(agentId)).agent.activeToolNames, this.cwd),
      model: createMuseProxyModel(backendAuth.backendUrl),
      getApiKeyAndHeaders: createBackendGetApiKeyAndHeaders(backendAuth, {
        task,
        selection: meta?.modelSelection,
      }),
    })

    const unsubscribeEvents = harness.subscribe(async event => {
      const mapped = mapHarnessEventToSse(event)
      if (mapped) {
        await this.eventHub.publish(sessionId, mapped)
      }
    })

    return { harness, unsubscribeEvents }
  }

  private async publishError(sessionId: string, message: string): Promise<void> {
    await this.eventHub.publish(sessionId, { type: 'error', message })
    await this.eventHub.publish(sessionId, { type: 'agent_end' })
  }
}

export class ChatServiceError extends Error {
  constructor(
    readonly code: 'session_not_found' | 'agent_not_found' | 'invalid_request' | 'session_busy',
    message: string,
  ) {
    super(message)
    this.name = 'ChatServiceError'
  }
}
