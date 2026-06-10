import type { SessionMeta } from './session'

/** WebSocket 推送的 agent 事件包装 */
export interface DaemonAgentEventMessage {
  type: 'agent_event'
  sessionId: string
  event: Record<string, unknown>
}

/** POST /sessions 请求体 */
export interface CreateSessionRequest {
  agentId?: string
  cwd?: string
}

/** POST /sessions 响应 */
export interface CreateSessionResponse {
  session: SessionMeta
}

/** GET /sessions 查询参数 */
export interface ListSessionsQuery {
  agentId?: string
}

/** GET /sessions 响应 */
export interface ListSessionsResponse {
  sessions: SessionMeta[]
}

/** GET /sessions/:id 响应 */
export interface GetSessionResponse {
  session: SessionMeta
  messages: unknown[]
  isStreaming: boolean
}

/** DELETE /sessions/:id 响应 */
export interface DeleteSessionResponse {
  deleted: true
  sessionId: string
}

/** POST /sessions/:id/prompt 请求体 */
export interface SessionPromptRequest {
  message: string
}

/** POST /sessions/:id/prompt 响应 */
export interface SessionPromptResponse {
  accepted: true
}

export interface DaemonErrorResponse {
  error: string
}
