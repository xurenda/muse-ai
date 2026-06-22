import type { ModelSelection, ModelStrategyConfig, ModelsConfigProviderOption, ModelTier, TaskModelSelection } from '@muse-ai/shared'
import { DEFAULT_MODEL_STRATEGY } from '@muse-ai/shared'

export interface ModelCatalogItem {
  modelRef: string
  providerId: string
  providerName: string
  modelId: string
  modelName: string
}

export const MODEL_TIERS: ModelTier[] = ['high', 'medium', 'low']

export function tierLabelKey(tier: ModelTier): 'tierHigh' | 'tierMedium' | 'tierLow' {
  if (tier === 'high') return 'tierHigh'
  if (tier === 'low') return 'tierLow'
  return 'tierMedium'
}

export function isSameModelSelection(a: ModelSelection | undefined, b: ModelSelection | undefined): boolean {
  if (a === undefined && b === undefined) return true
  if (a === undefined || b === undefined) return false
  if (a.type !== b.type) return false
  if (a.type === 'tier' && b.type === 'tier') return a.tier === b.tier
  if (a.type === 'model' && b.type === 'model') return a.modelRef === b.modelRef
  return false
}

export interface PickerTriggerLabels {
  primary: string
  secondary: string | null
}

/** 聊天 Picker trigger 主/副文案（tier 时副文案为解析到的具体模型名） */
export function resolvePickerTriggerLabels(
  modelSelection: ModelSelection | undefined,
  resolvedModelRef: string,
  catalog: ModelCatalogItem[],
  tierLabel: (tier: ModelTier) => string,
): PickerTriggerLabels {
  if (modelSelection?.type === 'tier') {
    return {
      primary: tierLabel(modelSelection.tier),
      secondary: resolveModelLabel(resolvedModelRef, catalog),
    }
  }

  return {
    primary: resolveModelLabel(resolvedModelRef, catalog),
    secondary: null,
  }
}

export function buildModelCatalog(options: ModelsConfigProviderOption[]): ModelCatalogItem[] {
  return options.flatMap(provider =>
    provider.models.map(model => ({
      modelRef: `${provider.id}/${model.id}`,
      providerId: provider.id,
      providerName: provider.name,
      modelId: model.id,
      modelName: model.name,
    })),
  )
}

export function resolveModelLabel(modelRef: string, catalog: ModelCatalogItem[]): string {
  const item = resolveCatalogItem(modelRef, catalog)
  if (item) return item.modelName
  const slash = modelRef.indexOf('/')
  if (slash <= 0) return modelRef
  return modelRef.slice(slash + 1)
}

export function resolveCatalogItem(modelRef: string, catalog: ModelCatalogItem[]): ModelCatalogItem | undefined {
  return catalog.find(entry => entry.modelRef === modelRef)
}

export function cloneModelStrategy(strategy: ModelStrategyConfig): ModelStrategyConfig {
  return structuredClone(strategy)
}

export function createEmptyModelStrategy(): ModelStrategyConfig {
  return cloneModelStrategy(DEFAULT_MODEL_STRATEGY)
}

export function encodeTierValue(tier: ModelTier): string {
  return `tier:${tier}`
}

export function encodeModelValue(modelRef: string): string {
  return `model:${modelRef}`
}

export function encodeFollowChatValue(): string {
  return 'follow_chat'
}

export function encodeModelSelection(selection: ModelSelection): string {
  if (selection.type === 'tier') return encodeTierValue(selection.tier)
  return encodeModelValue(selection.modelRef)
}

export function encodeTaskModelSelection(selection: TaskModelSelection): string {
  if (selection.type === 'follow_chat') return encodeFollowChatValue()
  return encodeModelSelection(selection)
}

export function decodeModelSelection(value: string, catalog: ModelCatalogItem[]): ModelSelection | null {
  if (value.startsWith('tier:')) {
    const tier = value.slice('tier:'.length) as ModelTier
    if (tier === 'high' || tier === 'medium' || tier === 'low') {
      return { type: 'tier', tier }
    }
    return null
  }
  if (value.startsWith('model:')) {
    const modelRef = value.slice('model:'.length)
    if (catalog.some(item => item.modelRef === modelRef)) {
      return { type: 'model', modelRef }
    }
    return null
  }
  return null
}

export function decodeTaskModelSelection(value: string, catalog: ModelCatalogItem[], allowFollowChat: boolean): TaskModelSelection | null {
  if (allowFollowChat && value === encodeFollowChatValue()) {
    return { type: 'follow_chat' }
  }
  return decodeModelSelection(value, catalog)
}

export function movePoolItem(items: readonly string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex < 0 || fromIndex >= items.length || toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) {
    return [...items]
  }
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  if (!item) return [...items]
  next.splice(toIndex, 0, item)
  return next
}

/** 拖拽排序：与 movePoolItem 相同语义，供 DnD onDragEnd 使用 */
export function reorderPoolItems(items: readonly string[], fromIndex: number, toIndex: number): string[] {
  return movePoolItem(items, fromIndex, toIndex)
}

export function removePoolItem(items: readonly string[], index: number): string[] {
  return items.filter((_, itemIndex) => itemIndex !== index)
}

export function addPoolItem(items: readonly string[], modelRef: string): string[] {
  if (!modelRef || items.includes(modelRef)) return [...items]
  return [...items, modelRef]
}

export function availablePoolModels(catalog: ModelCatalogItem[], pool: readonly string[]): ModelCatalogItem[] {
  const inPool = new Set(pool)
  return catalog.filter(item => !inPool.has(item.modelRef))
}
