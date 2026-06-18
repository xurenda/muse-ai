import { AgentHarness, NodeExecutionEnv } from '@earendil-works/pi-agent-core/node'
import type { AbortResult, AgentHarnessEvent, AgentTool, Session, ThinkingLevel } from '@earendil-works/pi-agent-core'
import type { AssistantMessage, ImageContent, Model } from '@earendil-works/pi-ai'
import { placeholderGetApiKeyAndHeaders } from './get-api-key.js'
import type { MuseHarnessOptions } from './types.js'

const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.'

/**
 * 封装 pi AgentHarness：固定 NodeExecutionEnv，暴露 subscribe 供 SSE 映射。
 * Tools 由 CLI 注入；阶段 2 起由 Agent 定义决定 active tools。
 */
export class MuseHarness {
  readonly env: NodeExecutionEnv
  readonly session: Session
  private readonly harness: AgentHarness

  constructor(options: MuseHarnessOptions) {
    this.env = new NodeExecutionEnv({ cwd: options.cwd })
    this.session = options.session
    const tools: AgentTool[] = options.tools ?? []

    this.harness = new AgentHarness({
      env: this.env,
      session: options.session,
      model: options.model,
      tools,
      activeToolNames: options.activeToolNames ?? tools.map(tool => tool.name),
      systemPrompt: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      getApiKeyAndHeaders: options.getApiKeyAndHeaders ?? placeholderGetApiKeyAndHeaders,
      thinkingLevel: options.thinkingLevel ?? 'off',
    })
  }

  subscribe(listener: (event: AgentHarnessEvent) => void | Promise<void>): () => void {
    return this.harness.subscribe(listener)
  }

  prompt(text: string, options?: { images?: ImageContent[] }): Promise<AssistantMessage> {
    return this.harness.prompt(text, options)
  }

  steer(text: string, options?: { images?: ImageContent[] }): Promise<void> {
    return this.harness.steer(text, options)
  }

  followUp(text: string, options?: { images?: ImageContent[] }): Promise<void> {
    return this.harness.followUp(text, options)
  }

  /** 中断当前 turn（含 LLM 流式与进行中的 tool） */
  abort(): Promise<AbortResult> {
    return this.harness.abort()
  }

  compact(customInstructions?: string): Promise<{
    summary: string
    firstKeptEntryId: string
    tokensBefore: number
    details?: unknown
  }> {
    return this.harness.compact(customInstructions)
  }

  getModel(): Model<string> {
    return this.harness.getModel()
  }

  setModel(model: Model<string>): Promise<void> {
    return this.harness.setModel(model)
  }

  getThinkingLevel(): ThinkingLevel {
    return this.harness.getThinkingLevel()
  }

  setThinkingLevel(level: ThinkingLevel): Promise<void> {
    return this.harness.setThinkingLevel(level)
  }
}
