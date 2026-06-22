import { z } from 'zod'
import { modelRefSchema } from './agent.js'
import type { ModelsConfigProviderOption } from './settings-api.js'

/** 模型档位：高 / 中 / 低 */
export const modelTierSchema = z.enum(['high', 'medium', 'low'])

export type ModelTier = z.infer<typeof modelTierSchema>

/** 用户或任务的模型选择（v0.1.1 不含 auto） */
export const modelSelectionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('tier'),
    tier: modelTierSchema,
  }),
  z.object({
    type: z.literal('model'),
    modelRef: modelRefSchema,
  }),
])

export type ModelSelection = z.infer<typeof modelSelectionSchema>

/** 辅助任务：可跟随对话选择 */
export const taskModelSelectionSchema = z.union([
  modelSelectionSchema,
  z.object({
    type: z.literal('follow_chat'),
  }),
])

export type TaskModelSelection = z.infer<typeof taskModelSelectionSchema>

export const modelStrategyPoolsSchema = z.object({
  high: z.array(modelRefSchema),
  medium: z.array(modelRefSchema),
  low: z.array(modelRefSchema),
})

export type ModelStrategyPools = z.infer<typeof modelStrategyPoolsSchema>

export const modelStrategyTaskRoutingSchema = z.object({
  chat: modelSelectionSchema,
  compaction: taskModelSelectionSchema,
  titleGeneration: taskModelSelectionSchema,
})

export type ModelStrategyTaskRouting = z.infer<typeof modelStrategyTaskRoutingSchema>

export const modelStrategyConfigSchema = z.object({
  pools: modelStrategyPoolsSchema,
  taskRouting: modelStrategyTaskRoutingSchema,
})

export type ModelStrategyConfig = z.infer<typeof modelStrategyConfigSchema>

/** PUT /settings/model-strategy */
export const updateModelStrategyRequestSchema = modelStrategyConfigSchema

export type UpdateModelStrategyRequest = z.infer<typeof updateModelStrategyRequestSchema>

/** GET /settings/model-strategy */
export interface ModelStrategyResponse {
  strategy: ModelStrategyConfig
  options: ModelsConfigProviderOption[]
}

/** 无历史配置时的默认策略 */
export const DEFAULT_MODEL_STRATEGY: ModelStrategyConfig = {
  pools: {
    high: [],
    medium: [],
    low: [],
  },
  taskRouting: {
    chat: { type: 'tier', tier: 'medium' },
    compaction: { type: 'follow_chat' },
    titleGeneration: { type: 'follow_chat' },
  },
}

export function modelRefToModelSelection(modelRef: string): ModelSelection {
  return { type: 'model', modelRef }
}

/** 从 legacy modelRef 推断 selection（仅 model 类型） */
export function modelSelectionFromLegacyModelRef(modelRef: string | undefined): ModelSelection | undefined {
  if (!modelRef?.trim()) return undefined
  return modelRefToModelSelection(modelRef.trim())
}
