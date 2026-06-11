/** GET /sessions/:id/trace 中的 LLM 请求快照 */
export interface SessionTraceRequest {
  /** 发往 provider 的完整 payload */
  payload: unknown
  capturedAt: string
}

/** 解析后的 assistant 消息摘要 */
export interface SessionTraceAssistantMessage {
  content: unknown
  toolCalls?: unknown[]
  usage?: Record<string, unknown>
  stopReason?: string
}

/** GET /sessions/:id/trace 中的 LLM 响应快照 */
export interface SessionTraceResponse {
  /** 原始 HTTP status */
  status: number
  /** thinking 块拼接文本（若有） */
  thinking?: string
  message: SessionTraceAssistantMessage
  capturedAt: string
}

/** GET /sessions/:id/trace 响应 */
export interface GetSessionTraceResponse {
  sessionId: string
  request?: SessionTraceRequest
  response?: SessionTraceResponse
  updatedAt?: string
}
