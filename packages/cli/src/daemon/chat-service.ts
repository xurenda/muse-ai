import type { ChatRequest, MuseSseEvent } from '@muse-ai/shared'
import type { MuseSessionStore } from '@muse-ai/core'
import type { SessionEventHub } from './event-hub.js'

const PHASE1_STUB_PREFIX = '[阶段 1 占位] '

/** 阶段 3 前：校验并入队；用占位事件验证 SSE 通路 */
export class ChatService {
  constructor(
    private readonly sessionStore: MuseSessionStore,
    private readonly eventHub: SessionEventHub,
  ) {}

  async enqueue(request: ChatRequest): Promise<{ accepted: true }> {
    const session = await this.sessionStore.get(request.sessionId)
    if (!session) {
      throw new ChatServiceError('session_not_found', `Session 不存在: ${request.sessionId}`)
    }

    await this.sessionStore.touch(request.sessionId)
    void this.dispatchStubTurn(request)
    return { accepted: true }
  }

  private async dispatchStubTurn(request: ChatRequest): Promise<void> {
    const { sessionId, message, mode } = request
    const events: MuseSseEvent[] = [
      { type: 'agent_start' },
      { type: 'turn_start' },
      { type: 'text_delta', delta: `${PHASE1_STUB_PREFIX}已收到 (${mode})：${message}` },
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
    readonly code: 'session_not_found',
    message: string,
  ) {
    super(message)
    this.name = 'ChatServiceError'
  }
}
