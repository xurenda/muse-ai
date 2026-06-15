import { AgentHarness, NodeExecutionEnv } from '@earendil-works/pi-agent-core/node'
import type { AgentHarnessEvent, AgentTool, Session } from '@earendil-works/pi-agent-core'
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
      activeToolNames: tools.map(tool => tool.name),
      systemPrompt: options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      getApiKeyAndHeaders: options.getApiKeyAndHeaders ?? placeholderGetApiKeyAndHeaders,
      thinkingLevel: options.thinkingLevel ?? 'off',
    })
  }

  subscribe(listener: (event: AgentHarnessEvent) => void | Promise<void>): () => void {
    return this.harness.subscribe(listener)
  }
}
