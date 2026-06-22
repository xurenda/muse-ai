import { DEFAULT_MODEL_STRATEGY, type ModelStrategyConfig } from '@muse-ai/shared'
import { fetchModelStrategy } from '../backend/model-strategy-api.js'
import type { BackendLlmAuthConfig } from '../backend/llm-auth.js'

const CACHE_TTL_MS = 5 * 60 * 1000

/** 从 Backend 拉取并缓存用户 model-strategy */
export class ModelStrategyProvider {
  private cache: { strategy: ModelStrategyConfig; fetchedAt: number } | null = null

  constructor(private readonly resolveBackendAuth: () => Promise<BackendLlmAuthConfig | undefined>) {}

  /** 获取策略；未配对或拉取失败时回退默认/旧缓存 */
  async getStrategy(): Promise<ModelStrategyConfig> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.strategy
    }

    const auth = await this.resolveBackendAuth()
    if (!auth?.deviceToken) {
      return this.cache?.strategy ?? DEFAULT_MODEL_STRATEGY
    }

    try {
      const response = await fetchModelStrategy(auth.backendUrl, auth.deviceToken)
      this.cache = { strategy: response.strategy, fetchedAt: Date.now() }
      return response.strategy
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(`[ModelStrategyProvider] 拉取 model-strategy 失败，使用缓存或默认策略: ${detail}`)
      return this.cache?.strategy ?? DEFAULT_MODEL_STRATEGY
    }
  }

  /** 设置变更后调用以强制下次重新拉取 */
  invalidate(): void {
    this.cache = null
  }

  /** 测试注入固定策略 */
  setStrategyForTest(strategy: ModelStrategyConfig): void {
    this.cache = { strategy, fetchedAt: Date.now() }
  }
}
