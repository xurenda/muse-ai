import type { MuseModelsConfig } from '@muse-ai/shared'
import {
  DEFAULT_MODEL_STRATEGY,
  modelStrategyConfigSchema,
  type ModelSelection,
  type ModelStrategyConfig,
  type UpdateModelStrategyRequest,
} from '@muse-ai/shared'
import { collectModelRefsFromStrategy, normalizeModelStrategyPools } from '@muse-ai/shared'
import { findCatalogModel } from './provider-catalog.js'

export class ModelStrategyValidationError extends Error {
  constructor(
    readonly code: 'invalid_request' | 'not_configured' | 'model_not_found',
    message: string,
  ) {
    super(message)
    this.name = 'ModelStrategyValidationError'
  }
}

interface LegacyUserSettingsRow {
  defaultProvider?: string | null
  defaultModel?: string | null
  modelStrategyJson?: string | null
}

export function parseStoredModelStrategy(json: string | null | undefined): ModelStrategyConfig | null {
  if (!json?.trim()) return null
  try {
    const parsed: unknown = JSON.parse(json)
    const result = modelStrategyConfigSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function serializeModelStrategy(strategy: ModelStrategyConfig): string {
  return JSON.stringify(strategy)
}

/** 从 legacy defaultProvider/defaultModel 迁移 */
export function migrateModelStrategyFromLegacy(row: LegacyUserSettingsRow): ModelStrategyConfig {
  const stored = parseStoredModelStrategy(row.modelStrategyJson)
  if (stored) return stored

  const strategy: ModelStrategyConfig = structuredClone(DEFAULT_MODEL_STRATEGY)
  const provider = row.defaultProvider?.trim()
  const modelId = row.defaultModel?.trim()
  if (provider && modelId) {
    const modelRef = `${provider}/${modelId}`
    strategy.pools.medium = [modelRef]
    strategy.taskRouting.chat = { type: 'model', modelRef }
  }
  return strategy
}

export function normalizeUpdateModelStrategy(input: UpdateModelStrategyRequest): ModelStrategyConfig {
  return {
    pools: normalizeModelStrategyPools(input.pools),
    taskRouting: input.taskRouting,
  }
}

export function validateModelStrategyForUser(strategy: ModelStrategyConfig, modelsStore: MuseModelsConfig, configuredProviderIds: ReadonlySet<string>): void {
  const refs = collectModelRefsFromStrategy(strategy)
  for (const modelRef of refs) {
    const slash = modelRef.indexOf('/')
    if (slash <= 0) {
      throw new ModelStrategyValidationError('invalid_request', `无效的 modelRef: ${modelRef}`)
    }
    const providerId = modelRef.slice(0, slash)
    const modelId = modelRef.slice(slash + 1)
    if (!configuredProviderIds.has(providerId)) {
      throw new ModelStrategyValidationError('not_configured', `Provider "${providerId}" 尚未配置凭证`)
    }
    if (!findCatalogModel(modelsStore, providerId, modelId)) {
      throw new ModelStrategyValidationError('model_not_found', `未找到模型: ${modelRef}`)
    }
  }
}

/** 从 strategy 推导 legacy defaultProvider/defaultModel（兼容 models-config） */
export function deriveLegacyDefaultFromStrategy(strategy: ModelStrategyConfig): {
  defaultProvider?: string
  defaultModel?: string
} {
  const chat = strategy.taskRouting.chat
  if (chat.type === 'model') {
    const slash = chat.modelRef.indexOf('/')
    if (slash <= 0) return {}
    return {
      defaultProvider: chat.modelRef.slice(0, slash),
      defaultModel: chat.modelRef.slice(slash + 1),
    }
  }

  const pool = strategy.pools[chat.tier]
  const first = pool[0]
  if (!first) return {}
  const slash = first.indexOf('/')
  if (slash <= 0) return {}
  return {
    defaultProvider: first.slice(0, slash),
    defaultModel: first.slice(slash + 1),
  }
}

export function selectionUsesEmptyTierPool(selection: ModelSelection, strategy: ModelStrategyConfig): boolean {
  if (selection.type !== 'tier') return false
  return strategy.pools[selection.tier].length === 0
}
