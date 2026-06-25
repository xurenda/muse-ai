import type { MuseLlmTask } from '../constants/llm-proxy.js'

/** GET /sessions/:id/llm-inspect 中的 LLM 请求快照 */
export interface SessionLlmInspectRequest {
  task: MuseLlmTask
  /** 发往 provider 的完整 payload */
  payload: unknown
  capturedAt: string
}

/** 解析后的 assistant 消息摘要 */
export interface SessionLlmInspectAssistantMessage {
  content: unknown
  toolCalls?: unknown[]
  toolResults?: unknown[]
  usage?: Record<string, unknown>
  stopReason?: string
  errorMessage?: string
}

/** GET /sessions/:id/llm-inspect 中的 LLM 响应快照 */
export interface SessionLlmInspectResponse {
  status: number
  resolvedModel?: string
  usedFallback?: boolean
  attemptedModelRefs?: string[]
  contextWindow?: number
  thinking?: string
  message: SessionLlmInspectAssistantMessage
  capturedAt: string
}

/** GET /sessions/:id/llm-inspect 响应 */
export interface GetSessionLlmInspectResponse {
  sessionId: string
  request?: SessionLlmInspectRequest
  response?: SessionLlmInspectResponse
  updatedAt?: string
}
