/** 会话元数据 */
export interface SessionMeta {
  id: string
  agentId: string
  /** 用户在 Web 选择的工作目录；不同会话可不同，daemon 启动时不设置 */
  cwd?: string
  /** 侧栏展示用，通常取首条用户消息摘要 */
  title?: string
  createdAt: string
  updatedAt?: string
  /** 已持久化的消息条数 */
  messageCount?: number
}

/** 线性 JSONL transcript 中的 message 条目 */
export interface SessionTranscriptMessageEntry {
  type: 'message'
  timestamp: string
  message: unknown
}
