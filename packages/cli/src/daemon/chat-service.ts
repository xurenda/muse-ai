import type { ChatRequest, MuseSseEvent } from '@muse-ai/shared'
import type { MuseAgentRegistry, MuseSessionStore } from '@muse-ai/core'
import type { SessionEventHub } from './event-hub.js'

const PHASE2_STUB_PREFIX = '[阶段 2 占位] '

function summarizeSystemPrompt(text: string, maxLen = 120): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, maxLen)}…`
}

/** 阶段 3 前：校验并入队；占位 SSE 携带 Agent 上下文摘要 */
export class ChatService {
  constructor(
    private readonly sessionStore: MuseSessionStore,
    private readonly eventHub: SessionEventHub,
    private readonly agentRegistry: MuseAgentRegistry,
  ) {}

  async enqueue(request: ChatRequest): Promise<{ accepted: true }> {
    const session = await this.sessionStore.get(request.sessionId)
    if (!session) {
      throw new ChatServiceError('session_not_found', `Session 不存在: ${request.sessionId}`)
    }

    await this.sessionStore.touch(request.sessionId)
    void this.dispatchStubTurn(request, session.agentId)
    return { accepted: true }
  }

  private async dispatchStubTurn(request: ChatRequest, agentId: string): Promise<void> {
    const { sessionId, message, mode } = request
    let contextLine: string

    try {
      const context = await this.agentRegistry.resolveRuntimeContext(agentId)
      const skillNames = context.skills.map(s => s.name).join(', ') || '-'
      contextLine = `Agent「${context.agent.name}」persona=${context.persona.definition.id} skills=${skillNames} | prompt: ${summarizeSystemPrompt(context.systemPrompt)}`
    } catch (error: unknown) {
      const messageText = error instanceof Error ? error.message : String(error)
      contextLine = `Agent 加载失败 (${agentId}): ${messageText}`
    }

    const events: MuseSseEvent[] = [
      { type: 'agent_start' },
      { type: 'turn_start' },
      { type: 'text_delta', delta: `${PHASE2_STUB_PREFIX}${contextLine}\n已收到 (${mode})：${message}` },
      { type: 'turn_end' },
      { type: 'agent_end' },
    ]

    for (const event of events) {
      await this.eventHub.publish(sessionId, event)
    }
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
