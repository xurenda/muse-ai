/** 会话元数据（持久化格式在 Step 2 定稿，cwd 由 Web 在创建/发送对话时注入） */
export interface SessionMeta {
  id: string
  agentId: string
  /** 用户在 Web 选择的工作目录；不同会话可不同，daemon 启动时不设置 */
  cwd?: string
  createdAt: string
  updatedAt?: string
}
