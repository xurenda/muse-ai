import type { ThinkingLevel } from '@muse-ai/shared'
import type { MuseAgentRegistry } from './agent-registry.js'
import type { MuseHarnessOptions } from './types.js'
import type { Session } from '@earendil-works/pi-agent-core'
import { parseModelRef } from './model-ref.js'
import { readSessionRuntimeOverrides, resolveEffectiveHarnessConfig } from './session-runtime.js'

/** 按 Agent + Session 树覆盖项构建 Harness 选项 */
export async function buildHarnessOptionsForSession(
  agentRegistry: MuseAgentRegistry,
  agentId: string,
  piSession: Session,
  cwd: string,
): Promise<MuseHarnessOptions> {
  const context = await agentRegistry.resolveRuntimeContext(agentId)
  const options = agentRegistry.buildHarnessOptions(context, piSession, cwd)
  const overrides = await readSessionRuntimeOverrides(piSession)
  const effective = resolveEffectiveHarnessConfig(
    context.persona.definition.defaultModel,
    context.persona.definition.thinkingLevel as ThinkingLevel | undefined,
    overrides,
  )
  options.model = parseModelRef(effective.modelRef)
  options.thinkingLevel = effective.thinkingLevel
  return options
}
