import type { Session } from '@earendil-works/pi-agent-core'
import type { ThinkingLevel } from '@muse-ai/shared'
import { DEFAULT_MODEL_REF, formatModelRef, parseModelRef } from './model-ref.js'

export interface SessionRuntimeOverrides {
  /** 会话树存在 model_change 条目 */
  hasModelOverride: boolean
  modelRef?: string
  /** 会话树存在 thinking_level_change 条目 */
  hasThinkingOverride: boolean
  thinkingLevel?: ThinkingLevel
}

/** 从 pi Session 树读取会话级 model / thinking 覆盖（相对 Persona 默认） */
export async function readSessionRuntimeOverrides(session: Session): Promise<SessionRuntimeOverrides> {
  const path = await session.getBranch()
  let hasModelOverride = false
  let hasThinkingOverride = false
  for (const entry of path) {
    if (entry.type === 'model_change') hasModelOverride = true
    if (entry.type === 'thinking_level_change') hasThinkingOverride = true
  }

  const context = await session.buildContext()
  const overrides: SessionRuntimeOverrides = { hasModelOverride, hasThinkingOverride }

  if (hasModelOverride && context.model) {
    try {
      overrides.modelRef = formatModelRef(parseModelRef(`${context.model.provider}/${context.model.modelId}`))
    } catch {
      overrides.modelRef = `${context.model.provider}/${context.model.modelId}`
    }
  }

  if (hasThinkingOverride) {
    overrides.thinkingLevel = context.thinkingLevel as ThinkingLevel
  }

  return overrides
}

/** 合并 Persona 默认与会话覆盖，得到 Harness 应使用的 model / thinking */
export function resolveEffectiveHarnessConfig(
  personaDefaultModel: string | undefined,
  personaDefaultThinking: ThinkingLevel | undefined,
  overrides: SessionRuntimeOverrides,
): { modelRef: string; thinkingLevel: ThinkingLevel } {
  return {
    modelRef: overrides.hasModelOverride && overrides.modelRef ? overrides.modelRef : (personaDefaultModel ?? DEFAULT_MODEL_REF),
    thinkingLevel: overrides.hasThinkingOverride && overrides.thinkingLevel !== undefined ? overrides.thinkingLevel : (personaDefaultThinking ?? 'off'),
  }
}
