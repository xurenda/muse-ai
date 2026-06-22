import type { ModelSelection, ModelStrategyConfig, ModelStrategyPools } from '../types/model-strategy.js'

/** 池内去重，保留首次出现顺序 */
export function dedupeModelPoolRefs(refs: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const ref of refs) {
    if (seen.has(ref)) continue
    seen.add(ref)
    result.push(ref)
  }
  return result
}

/** 规范化 pools：各档去重 */
export function normalizeModelStrategyPools(pools: ModelStrategyPools): ModelStrategyPools {
  return {
    high: dedupeModelPoolRefs(pools.high),
    medium: dedupeModelPoolRefs(pools.medium),
    low: dedupeModelPoolRefs(pools.low),
  }
}

/** 收集 strategy 内所有 modelRef（去重，保序） */
export function collectModelRefsFromStrategy(strategy: ModelStrategyConfig): string[] {
  const seen = new Set<string>()
  const refs: string[] = []

  const push = (ref: string) => {
    if (seen.has(ref)) return
    seen.add(ref)
    refs.push(ref)
  }

  for (const tier of ['high', 'medium', 'low'] as const) {
    for (const ref of strategy.pools[tier]) {
      push(ref)
    }
  }

  const pushSelection = (selection: ModelSelection) => {
    if (selection.type === 'model') push(selection.modelRef)
  }

  pushSelection(strategy.taskRouting.chat)
  if (strategy.taskRouting.compaction.type === 'model') {
    push(strategy.taskRouting.compaction.modelRef)
  }
  if (strategy.taskRouting.titleGeneration.type === 'model') {
    push(strategy.taskRouting.titleGeneration.modelRef)
  }

  return refs
}
