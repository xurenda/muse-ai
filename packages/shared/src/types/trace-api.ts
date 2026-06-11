/** 单条 LLM trace 记录（jsonl 一行） */
export interface LlmTraceEntry {
  timestamp: string
  turnIndex: number
  type: string
  systemPrompt?: string
  model?: Record<string, unknown>
  payload?: unknown
  status?: number
  headers?: Record<string, string>
  messageRole?: string
  toolResultCount?: number
}

/** GET /sessions/:id/traces 中的 turn 摘要 */
export interface SessionTraceSummary {
  turnIndex: number
  entryCount: number
  updatedAt?: string
  /** 首条 provider_request 解析出的模型标识（若有） */
  modelLabel?: string
}

/** GET /sessions/:id/traces 响应 */
export interface ListSessionTracesResponse {
  sessionId: string
  traces: SessionTraceSummary[]
}

/** GET /sessions/:id/traces/:turnIndex 响应 */
export interface GetSessionTraceResponse {
  sessionId: string
  turnIndex: number
  entries: LlmTraceEntry[]
}
