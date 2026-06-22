import type { ModelSelection, ModelStrategyConfig, ModelStrategyPools, TaskModelSelection } from '@muse-ai/shared'
import { DEFAULT_MODEL_REF } from './model-ref.js'
import { expandModelSelection, expandTaskModelSelection, resolvePrimaryModelCandidate } from './model-strategy.js'

/** 会话/chat 有效 selection：registry → 全局 taskRouting.chat → Persona → 默认 modelRef */
export function resolveEffectiveChatModelSelection(
  sessionSelection: ModelSelection | undefined,
  strategy: ModelStrategyConfig,
  personaDefaultModel?: string,
): ModelSelection {
  if (sessionSelection) return sessionSelection
  if (strategy.taskRouting.chat) return strategy.taskRouting.chat
  if (personaDefaultModel) return { type: 'model', modelRef: personaDefaultModel }
  return { type: 'model', modelRef: DEFAULT_MODEL_REF }
}

/** 解析 selection 在 pools 中的首个 modelRef；池空时返回 fallback */
export function resolvePrimaryModelRef(selection: ModelSelection, pools: ModelStrategyPools, fallbackModelRef: string = DEFAULT_MODEL_REF): string {
  const candidate = resolvePrimaryModelCandidate(selection, pools)
  return candidate?.modelRef ?? fallbackModelRef
}

/** 按任务展开候选 modelRef 列表 */
export function resolveTaskModelCandidates(
  task: 'chat' | 'compaction' | 'titleGeneration',
  strategy: ModelStrategyConfig,
  chatSelection: ModelSelection,
): string[] {
  if (task === 'chat') {
    return expandModelSelection(chatSelection, strategy.pools)
  }

  const taskSelection: TaskModelSelection = task === 'compaction' ? strategy.taskRouting.compaction : strategy.taskRouting.titleGeneration
  return expandTaskModelSelection(taskSelection, chatSelection, strategy.pools)
}
