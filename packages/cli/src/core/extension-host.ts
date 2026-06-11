import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Agent, AgentEvent, AgentMessage, AgentTool } from '@earendil-works/pi-agent-core'
import {
  AuthStorage,
  convertToLlm,
  discoverAndLoadExtensions,
  ExtensionRunner,
  ModelRegistry,
  SessionManager,
  wrapRegisteredTools,
  type ExtensionError,
  type LoadExtensionsResult,
} from '@earendil-works/pi-coding-agent'
import {
  pluginInstallRelativePath,
  resolvePluginManifestEntry,
  type AgentResourceEnableList,
  type RegistryFile,
} from '@muse-ai/shared'
import {
  getAgentPluginsPath,
  getAuthPath,
  getExtensionRuntimeDir,
  getModelsPath,
  getMuseHomeDir,
  getRegistryPluginsPath,
} from '../data/paths'
import { readPluginManifestFromDir } from './plugin-manifest'
import { readJsonFileIfExists } from './read-json-file'
import { resolvePluginRoot } from './resolve-plugin-root'

export interface MuseExtensionHostOptions {
  agentId: string
  sessionId: string
  cwd: string
}

export interface MuseExtensionHost {
  readonly runner: ExtensionRunner
  readonly warnings: string[]
  readonly loadErrors: LoadExtensionsResult['errors']
  getTools(): AgentTool[]
  wireAgent(agent: Agent): void
  handleAgentEvent(event: AgentEvent): Promise<void>
  emitSessionStart(reason: 'startup' | 'resume'): Promise<void>
  emitSessionShutdown(): Promise<void>
  onError(listener: (error: ExtensionError) => void): () => void
}

function replaceMessageInPlace(target: AgentMessage, replacement: AgentMessage): void {
  if (target === replacement) {
    return
  }

  const targetRecord = target as unknown as Record<string, unknown>
  for (const key of Object.keys(targetRecord)) {
    delete targetRecord[key]
  }
  Object.assign(targetRecord, replacement)
}

function unavailableRuntimeAction(action: string): never {
  throw new Error(`Muse daemon 暂不支持扩展运行时操作: ${action}`)
}

async function readEnabledPluginIds(agentId: string): Promise<string[]> {
  const enableList = await readJsonFileIfExists<AgentResourceEnableList>(getAgentPluginsPath(agentId))
  return enableList?.enabled ?? []
}

async function resolveExtensionAbsolutePaths(pluginId: string): Promise<string[]> {
  const pluginRoot = await resolvePluginRoot(pluginId)
  if (!pluginRoot) {
    return []
  }

  const manifest = await readPluginManifestFromDir(pluginRoot)
  if (manifest.id !== pluginId) {
    throw new Error(`Plugin manifest id 不匹配: 期望 ${pluginId}，实际 ${manifest.id}`)
  }

  const registry = await readJsonFileIfExists<RegistryFile>(getRegistryPluginsPath())
  const registryEntry = registry?.items.find((item) => item.id === pluginId)
  const installRelativePath = registryEntry?.path ?? pluginInstallRelativePath(pluginId)

  const paths: string[] = []
  for (const entry of manifest.extensions) {
    const relativePath = resolvePluginManifestEntry(installRelativePath, entry)
    paths.push(join(getMuseHomeDir(), relativePath))
  }
  return paths
}

async function collectExtensionPaths(agentId: string): Promise<{ paths: string[]; warnings: string[] }> {
  const warnings: string[] = []
  const paths: string[] = []
  const enabledPluginIds = await readEnabledPluginIds(agentId)

  for (const pluginId of enabledPluginIds) {
    const pluginRoot = await resolvePluginRoot(pluginId)
    if (!pluginRoot) {
      warnings.push(`Plugin 未安装或缺少 manifest: ${pluginId}`)
      continue
    }

    const extensionPaths = await resolveExtensionAbsolutePaths(pluginId)
    if (extensionPaths.length === 0) {
      warnings.push(`Plugin 未声明 extensions: ${pluginId}`)
      continue
    }

    paths.push(...extensionPaths)
  }

  return { paths, warnings }
}

function createPiSessionManager(sessionId: string, cwd: string): SessionManager {
  return SessionManager.create(cwd, getExtensionRuntimeDir(sessionId), { id: sessionId })
}

function createPiModelRegistry(): ModelRegistry {
  const authStorage = AuthStorage.create(getAuthPath())
  return ModelRegistry.create(authStorage, getModelsPath())
}

function bindExtensionCore(
  runner: ExtensionRunner,
  agent: Agent,
  cwd: string,
  sessionManager: SessionManager,
): void {
  runner.bindCore(
    {
      sendMessage: () => unavailableRuntimeAction('sendMessage'),
      sendUserMessage: () => unavailableRuntimeAction('sendUserMessage'),
      appendEntry: (customType, data) => {
        sessionManager.appendCustomEntry(customType, data)
      },
      setSessionName: (name) => {
        sessionManager.appendSessionInfo(name)
      },
      getSessionName: () => sessionManager.getSessionName(),
      setLabel: (entryId, label) => {
        sessionManager.appendLabelChange(entryId, label)
      },
      getActiveTools: () => agent.state.tools.map((tool) => tool.name),
      getAllTools: () =>
        runner.getAllRegisteredTools().map((tool) => ({
          name: tool.definition.name,
          description: tool.definition.description,
          parameters: tool.definition.parameters,
          promptGuidelines: tool.definition.promptGuidelines,
          sourceInfo: tool.sourceInfo,
        })),
      setActiveTools: () => unavailableRuntimeAction('setActiveTools'),
      refreshTools: () => unavailableRuntimeAction('refreshTools'),
      getCommands: () => runner.getRegisteredCommands().map((command) => ({
        name: command.invocationName,
        description: command.description,
        source: 'extension' as const,
        sourceInfo: command.sourceInfo,
      })),
      setModel: async (model) => {
        agent.state.model = model
        return true
      },
      getThinkingLevel: () => agent.state.thinkingLevel,
      setThinkingLevel: (level) => {
        agent.state.thinkingLevel = level
      },
    },
    {
      getModel: () => agent.state.model,
      isIdle: () => !agent.state.isStreaming,
      isProjectTrusted: () => true,
      getSignal: () => agent.signal,
      abort: () => {
        agent.abort()
      },
      hasPendingMessages: () => agent.hasQueuedMessages(),
      shutdown: () => unavailableRuntimeAction('shutdown'),
      getContextUsage: () => undefined,
      compact: () => unavailableRuntimeAction('compact'),
      getSystemPrompt: () => agent.state.systemPrompt,
      getSystemPromptOptions: () => ({ cwd }),
    },
  )

  runner.bindCommandContext({
    waitForIdle: () => agent.waitForIdle(),
    newSession: async () => ({ cancelled: true }),
    fork: async () => ({ cancelled: true }),
    navigateTree: async () => ({ cancelled: true }),
    switchSession: async () => ({ cancelled: true }),
    reload: async () => unavailableRuntimeAction('reload'),
  })
}

class MuseExtensionHostImpl implements MuseExtensionHost {
  readonly runner: ExtensionRunner
  readonly warnings: string[]
  readonly loadErrors: LoadExtensionsResult['errors']
  private readonly cwd: string
  private readonly piSessionManager: SessionManager
  private turnIndex = 0

  private constructor(
    runner: ExtensionRunner,
    extensionsResult: LoadExtensionsResult,
    piSessionManager: SessionManager,
    warnings: string[],
    cwd: string,
  ) {
    this.runner = runner
    this.loadErrors = extensionsResult.errors
    this.piSessionManager = piSessionManager
    this.warnings = warnings
    this.cwd = cwd
  }

  static async create(options: MuseExtensionHostOptions): Promise<MuseExtensionHostImpl> {
    const cwd = options.cwd.trim() || process.cwd()
    const { paths, warnings } = await collectExtensionPaths(options.agentId)

    await mkdir(getExtensionRuntimeDir(options.sessionId), { recursive: true })

    const extensionsResult = await discoverAndLoadExtensions(paths, cwd)
    const sessionManager = createPiSessionManager(options.sessionId, cwd)
    const modelRegistry = createPiModelRegistry()
    const runner = new ExtensionRunner(
      extensionsResult.extensions,
      extensionsResult.runtime,
      cwd,
      sessionManager,
      modelRegistry,
    )

    return new MuseExtensionHostImpl(runner, extensionsResult, sessionManager, warnings, cwd)
  }

  getTools(): AgentTool[] {
    return wrapRegisteredTools(this.runner.getAllRegisteredTools(), this.runner)
  }

  wireAgent(agent: Agent): void {
    bindExtensionCore(this.runner, agent, this.cwd, this.piSessionManager)

    agent.convertToLlm = convertToLlm
    agent.sessionId = this.piSessionManager.getSessionId()

    agent.onPayload = async (payload, _model) => {
      if (!this.runner.hasHandlers('before_provider_request')) {
        return payload
      }
      return this.runner.emitBeforeProviderRequest(payload)
    }

    agent.onResponse = async (response, _model) => {
      if (!this.runner.hasHandlers('after_provider_response')) {
        return
      }
      await this.runner.emit({
        type: 'after_provider_response',
        status: response.status,
        headers: response.headers,
      })
    }

    agent.transformContext = async (messages) => {
      return this.runner.emitContext(messages)
    }

    agent.beforeToolCall = async ({ toolCall, args }) => {
      if (!this.runner.hasHandlers('tool_call')) {
        return undefined
      }

      try {
        return await this.runner.emitToolCall({
          type: 'tool_call',
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          input: args as Record<string, unknown>,
        })
      } catch (error) {
        if (error instanceof Error) {
          throw error
        }
        throw new Error(`Extension 拦截工具调用失败: ${String(error)}`)
      }
    }

    agent.afterToolCall = async ({ toolCall, args, result, isError }) => {
      if (!this.runner.hasHandlers('tool_result')) {
        return undefined
      }

      const hookResult = await this.runner.emitToolResult({
        type: 'tool_result',
        toolName: toolCall.name,
        toolCallId: toolCall.id,
        input: args as Record<string, unknown>,
        content: result.content,
        details: result.details,
        isError,
      })

      if (!hookResult) {
        return undefined
      }

      return {
        content: hookResult.content,
        details: hookResult.details,
        isError: hookResult.isError ?? isError,
      }
    }
  }

  async handleAgentEvent(event: AgentEvent): Promise<void> {
    if (event.type === 'agent_start') {
      this.turnIndex = 0
      await this.runner.emit({ type: 'agent_start' })
      return
    }

    if (event.type === 'agent_end') {
      await this.runner.emit({ type: 'agent_end', messages: event.messages })
      return
    }

    if (event.type === 'turn_start') {
      await this.runner.emit({
        type: 'turn_start',
        turnIndex: this.turnIndex,
        timestamp: Date.now(),
      })
      return
    }

    if (event.type === 'turn_end') {
      await this.runner.emit({
        type: 'turn_end',
        turnIndex: this.turnIndex,
        message: event.message,
        toolResults: event.toolResults,
      })
      this.turnIndex += 1
      return
    }

    if (event.type === 'message_start') {
      await this.runner.emit({
        type: 'message_start',
        message: event.message,
      })
      return
    }

    if (event.type === 'message_update') {
      await this.runner.emit({
        type: 'message_update',
        message: event.message,
        assistantMessageEvent: event.assistantMessageEvent,
      })
      return
    }

    if (event.type === 'message_end') {
      const replacement = await this.runner.emitMessageEnd({
        type: 'message_end',
        message: event.message,
      })
      if (replacement) {
        replaceMessageInPlace(event.message, replacement)
      }
      return
    }

    if (event.type === 'tool_execution_start') {
      await this.runner.emit({
        type: 'tool_execution_start',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      })
      return
    }

    if (event.type === 'tool_execution_update') {
      await this.runner.emit({
        type: 'tool_execution_update',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        partialResult: event.partialResult,
      })
      return
    }

    if (event.type === 'tool_execution_end') {
      await this.runner.emit({
        type: 'tool_execution_end',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
        isError: event.isError,
      })
    }
  }

  async emitSessionStart(reason: 'startup' | 'resume'): Promise<void> {
    await this.runner.emit({ type: 'session_start', reason })
  }

  async emitSessionShutdown(): Promise<void> {
    await this.runner.emit({ type: 'session_shutdown', reason: 'quit' })
  }

  onError(listener: (error: ExtensionError) => void): () => void {
    return this.runner.onError(listener)
  }
}

export async function createMuseExtensionHost(options: MuseExtensionHostOptions): Promise<MuseExtensionHost> {
  const host = await MuseExtensionHostImpl.create(options)

  for (const warning of host.warnings) {
    console.warn(`[muse] ${warning}`)
  }

  for (const error of host.loadErrors) {
    console.warn(`[muse] 加载 Extension 失败 (${error.path}): ${error.error}`)
  }

  host.onError((error: ExtensionError) => {
    console.warn(
      `[muse] Extension 事件处理失败 (${error.extensionPath}, ${error.event}): ${error.error}`,
    )
    if (error.stack) {
      console.warn(error.stack)
    }
  })

  return host
}
