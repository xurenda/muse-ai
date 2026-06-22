import { modelRefSchema } from '../types/agent.js'
import { modelTierSchema, type ModelSelection, type ModelTier } from '../types/model-strategy.js'

/** LLM 代理任务类型（与 X-Muse-Task 一致） */
export const MUSE_LLM_TASKS = ['chat', 'compaction', 'titleGeneration'] as const

export type MuseLlmTask = (typeof MUSE_LLM_TASKS)[number]

/** Server LLM 代理 / CLI 请求头名 */
export const MUSE_PROXY_HEADERS = {
  TASK: 'X-Muse-Task',
  SELECTION: 'X-Muse-Selection',
  /** @deprecated 解析后以 modelRef 的 provider 为准 */
  PROVIDER: 'X-Muse-Provider',
  RESOLVED_MODEL: 'X-Muse-Resolved-Model',
  FALLBACK_USED: 'X-Muse-Fallback-Used',
  ATTEMPTED_MODELS: 'X-Muse-Attempted-Models',
} as const

const MODEL_SELECTION_HEADER_PREFIX = {
  tier: 'tier:',
  model: 'model:',
} as const

/** 将 ModelSelection 编码为 X-Muse-Selection 值 */
export function encodeModelSelectionHeader(selection: ModelSelection): string {
  if (selection.type === 'tier') {
    return `${MODEL_SELECTION_HEADER_PREFIX.tier}${selection.tier}`
  }
  return `${MODEL_SELECTION_HEADER_PREFIX.model}${selection.modelRef}`
}

/** 解析 X-Muse-Selection；非法格式返回 null */
export function parseModelSelectionHeader(value: string): ModelSelection | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (trimmed.startsWith(MODEL_SELECTION_HEADER_PREFIX.tier)) {
    const tier = trimmed.slice(MODEL_SELECTION_HEADER_PREFIX.tier.length) as ModelTier
    const parsed = modelTierSchema.safeParse(tier)
    if (!parsed.success) return null
    return { type: 'tier', tier: parsed.data }
  }

  if (trimmed.startsWith(MODEL_SELECTION_HEADER_PREFIX.model)) {
    const modelRef = trimmed.slice(MODEL_SELECTION_HEADER_PREFIX.model.length)
    const parsed = modelRefSchema.safeParse(modelRef)
    if (!parsed.success) return null
    return { type: 'model', modelRef: parsed.data }
  }

  return null
}

/** 解析 X-Muse-Task；非法值返回 null */
export function parseMuseLlmTask(value: string | null | undefined): MuseLlmTask | null {
  if (!value?.trim()) return null
  const task = value.trim()
  return MUSE_LLM_TASKS.includes(task as MuseLlmTask) ? (task as MuseLlmTask) : null
}

/** 从 modelRef 提取 providerId */
export function parseProviderIdFromModelRef(modelRef: string): string | null {
  const slash = modelRef.indexOf('/')
  if (slash <= 0) return null
  return modelRef.slice(0, slash)
}
