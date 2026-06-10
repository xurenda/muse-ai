import type { SessionMeta } from './session'

/** WebSocket 推送的 agent 事件包装 */
export interface DaemonAgentEventMessage {
  type: 'agent_event'
  sessionId: string
  event: Record<string, unknown>
}

/** WebSocket 连接时推送的会话快照（供重连对齐内存状态） */
export interface DaemonSessionSnapshotMessage {
  type: 'session_snapshot'
  sessionId: string
  messages: unknown[]
  isStreaming: boolean
}

/** WebSocket 推送的会话级错误（fire-and-forget prompt 失败等） */
export interface DaemonSessionErrorMessage {
  type: 'session_error'
  sessionId: string
  error: string
}

/** WebSocket 推送的会话流式状态变更 */
export interface DaemonSessionStateMessage {
  type: 'session_state'
  sessionId: string
  isStreaming: boolean
}

/** daemon WebSocket 下行消息联合类型 */
export type DaemonWsMessage =
  | DaemonAgentEventMessage
  | DaemonSessionSnapshotMessage
  | DaemonSessionErrorMessage
  | DaemonSessionStateMessage

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

/** POST /sessions/:id/abort 响应 */
export interface SessionAbortResponse {
  aborted: true
}

/** POST /sessions/:id/steer 请求体 */
export interface SessionSteerRequest {
  message: string
}

/** POST /sessions/:id/steer 响应 */
export interface SessionSteerResponse {
  accepted: true
}

/** POST /sessions/:id/follow-up 请求体 */
export interface SessionFollowUpRequest {
  message: string
}

/** POST /sessions/:id/follow-up 响应 */
export interface SessionFollowUpResponse {
  accepted: true
}

export interface DaemonErrorResponse {
  error: string
}
