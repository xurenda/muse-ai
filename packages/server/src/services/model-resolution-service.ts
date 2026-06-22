import { parseModelSelectionHeader, parseProviderIdFromModelRef, type ModelSelection, type ModelStrategyConfig, type MuseLlmTask } from '@muse-ai/shared'
import { resolveEffectiveChatModelSelection, resolveTaskModelCandidates } from '@muse-ai/core'
import type { SettingsService } from './settings-service.js'

export interface ModelResolutionDeps {
  loadStrategy(userId: string): Promise<ModelStrategyConfig>
  isProviderConfigured(userId: string, providerId: string): Promise<boolean>
}

export interface ResolveModelCandidatesParams {
  userId: string
  task: MuseLlmTask
  /** X-Muse-Selection 原始值；省略时 chat 用 taskRouting.chat */
  selectionHeader?: string | null
}

export interface ModelResolutionResult {
  /** 过滤已配置 Provider 后的有序候选 */
  candidates: readonly string[]
  /** 展开后、过滤前的候选（日志/调试） */
  expandedCandidates: readonly string[]
  /** 用于 chat 链路的有效 selection */
  chatSelection: ModelSelection
}

export class ModelResolutionError extends Error {
  constructor(
    readonly code: 'invalid_selection',
    message: string,
  ) {
    super(message)
    this.name = 'ModelResolutionError'
  }
}

/** Server 侧：按 task + selection 展开 modelRef 候选并过滤未配置 Provider */
export class ModelResolutionService {
  constructor(private readonly deps: ModelResolutionDeps) {}

  async resolveCandidates(params: ResolveModelCandidatesParams): Promise<ModelResolutionResult> {
    const { userId, task, selectionHeader } = params
    const strategy = await this.deps.loadStrategy(userId)
    const sessionSelection = this.parseSelectionHeader(selectionHeader)
    const chatSelection = resolveEffectiveChatModelSelection(sessionSelection, strategy, undefined)
    const expandedCandidates = resolveTaskModelCandidates(task, strategy, chatSelection)
    const candidates = await this.filterConfiguredCandidates(userId, expandedCandidates)

    return {
      candidates,
      expandedCandidates,
      chatSelection,
    }
  }

  private parseSelectionHeader(selectionHeader: string | null | undefined): ModelSelection | undefined {
    if (!selectionHeader?.trim()) return undefined

    const parsed = parseModelSelectionHeader(selectionHeader)
    if (!parsed) {
      throw new ModelResolutionError('invalid_selection', `无效的 X-Muse-Selection: ${selectionHeader}`)
    }
    return parsed
  }

  private async filterConfiguredCandidates(userId: string, candidates: readonly string[]): Promise<string[]> {
    const filtered: string[] = []
    for (const modelRef of candidates) {
      const providerId = parseProviderIdFromModelRef(modelRef)
      if (!providerId) continue
      if (await this.deps.isProviderConfigured(userId, providerId)) {
        filtered.push(modelRef)
      }
    }
    return filtered
  }
}

export function createModelResolutionService(settingsService: SettingsService): ModelResolutionService {
  return new ModelResolutionService({
    loadStrategy: async userId => (await settingsService.getModelStrategy(userId)).strategy,
    isProviderConfigured: (userId, providerId) => settingsService.isProviderConfigured(userId, providerId),
  })
}
