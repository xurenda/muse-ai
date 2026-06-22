import type { ModelSelection, ThinkingLevel } from '@muse-ai/shared'
import { modelRefToModelSelection } from '@muse-ai/shared'
import type { SessionSettingsPatch, SessionSettingsResponse } from '@muse-ai/shared'
import { sessionSettingsResponseSchema } from '@muse-ai/shared'
import type { MuseAgentRegistry, MuseSessionStore } from '@muse-ai/core'
import { MuseHarness, placeholderGetApiKeyAndHeaders, readSessionRuntimeOverrides, readSessionTokenUsage, resolveEffectiveHarnessConfig } from '@muse-ai/core'
import { resolveActiveTools } from '@/tools/index.js'

/** settings 响应中的 modelRef：仅回显 chat 粘性解析或显式 model 选择 */
function resolveSessionSettingsModelRef(meta: { lastResolvedModelRef?: string }, selection: ModelSelection | undefined): string | undefined {
  if (meta.lastResolvedModelRef) return meta.lastResolvedModelRef
  if (selection?.type === 'model') return selection.modelRef
  return undefined
}

export class SessionSettingsService {
  constructor(
    private readonly sessionStore: MuseSessionStore,
    private readonly agentRegistry: MuseAgentRegistry,
    private readonly cwd: string,
  ) {}

  async get(sessionId: string): Promise<SessionSettingsResponse> {
    const meta = await this.sessionStore.get(sessionId)
    if (!meta) {
      throw new SessionSettingsError('session_not_found', `Session 不存在: ${sessionId}`)
    }

    const piSession = await this.sessionStore.openPiSession(sessionId)
    if (!piSession) {
      throw new SessionSettingsError('session_not_found', `Session 不存在: ${sessionId}`)
    }

    const context = await this.agentRegistry.resolveRuntimeContext(meta.agentId)
    const overrides = await readSessionRuntimeOverrides(piSession)
    const effectiveHarness = resolveEffectiveHarnessConfig(
      context.persona.definition.defaultModel,
      context.persona.definition.thinkingLevel as ThinkingLevel | undefined,
      overrides,
    )
    const storedSelection = meta.modelSelection
    const legacySelection = !storedSelection && overrides.hasModelOverride && overrides.modelRef ? modelRefToModelSelection(overrides.modelRef) : undefined
    const tokenUsage = await readSessionTokenUsage(piSession)

    return sessionSettingsResponseSchema.parse({
      sessionId,
      agentId: meta.agentId,
      modelRef: resolveSessionSettingsModelRef(meta, storedSelection ?? legacySelection),
      modelSelection: storedSelection ?? legacySelection,
      thinkingLevel: effectiveHarness.thinkingLevel,
      tokenUsage,
    })
  }

  async patch(sessionId: string, patch: SessionSettingsPatch): Promise<SessionSettingsResponse> {
    let meta = await this.sessionStore.get(sessionId)
    if (!meta) {
      throw new SessionSettingsError('session_not_found', `Session 不存在: ${sessionId}`)
    }

    if (patch.agentId !== undefined) {
      const agent = await this.agentRegistry.getAgent(patch.agentId)
      if (!agent) {
        throw new SessionSettingsError('agent_not_found', `Agent 不存在: ${patch.agentId}`)
      }
      const updated = await this.sessionStore.updateAgentId(sessionId, patch.agentId)
      if (!updated) {
        throw new SessionSettingsError('session_not_found', `Session 不存在: ${sessionId}`)
      }
      meta = updated
    }

    const nextSelection: ModelSelection | undefined =
      patch.modelSelection ?? (patch.modelRef !== undefined ? modelRefToModelSelection(patch.modelRef) : undefined)

    if (nextSelection !== undefined || patch.thinkingLevel !== undefined) {
      const piSession = await this.sessionStore.openPiSession(sessionId)
      if (!piSession) {
        throw new SessionSettingsError('session_not_found', `Session 不存在: ${sessionId}`)
      }

      if (nextSelection !== undefined) {
        await this.sessionStore.updateModelSelection(sessionId, nextSelection)
      }

      const context = await this.agentRegistry.resolveRuntimeContext(meta.agentId)
      const harnessOptions = this.agentRegistry.buildHarnessOptions(context, piSession, this.cwd)
      const tools = resolveActiveTools(context.agent.activeToolNames, this.cwd)
      const harness = new MuseHarness({
        ...harnessOptions,
        tools,
        getApiKeyAndHeaders: placeholderGetApiKeyAndHeaders,
      })

      if (patch.thinkingLevel !== undefined) {
        await harness.setThinkingLevel(patch.thinkingLevel as ThinkingLevel)
      }
    }

    await this.sessionStore.touch(sessionId)
    return this.get(sessionId)
  }
}

export class SessionSettingsError extends Error {
  constructor(
    readonly code: 'session_not_found' | 'agent_not_found' | 'invalid_request',
    message: string,
  ) {
    super(message)
    this.name = 'SessionSettingsError'
  }
}
