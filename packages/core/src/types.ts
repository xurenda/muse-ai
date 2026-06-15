import type { Model } from '@earendil-works/pi-ai'
import type { AgentHarnessOptions, AgentTool, Session, ThinkingLevel } from '@earendil-works/pi-agent-core'

/** MuseHarness 构造选项（Session 由调用方注入，JSONL 接线在 CLI 层） */
export interface MuseHarnessOptions {
  /** Agent 工作目录，用于 NodeExecutionEnv */
  cwd: string
  session: Session
  model: Model<string>
  systemPrompt?: AgentHarnessOptions['systemPrompt']
  tools?: AgentTool[]
  thinkingLevel?: ThinkingLevel
  /** 阶段 3 接 Backend Provider 代理；默认使用占位实现 */
  getApiKeyAndHeaders?: AgentHarnessOptions['getApiKeyAndHeaders']
}
