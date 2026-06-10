import {
  getEnvApiKey,
  getModels,
  getProviders,
  type Api,
  type KnownProvider,
  type Model,
} from '@earendil-works/pi-ai'
import type { AgentInstanceConfig, AuthStorageData, MuseModelsConfig } from '@muse-ai/shared'
import { getAuthPath, getModelsPath } from '../data/paths'
import { readAuthData, readJsonFileIfExists } from './read-json-file'

const DEFAULT_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

function parseCustomModels(config: MuseModelsConfig): Model<Api>[] {
  const models: Model<Api>[] = []
  const providers = config.providers ?? {}
  const builtInProviders = new Set(getProviders())

  for (const [providerName, providerConfig] of Object.entries(providers)) {
    const modelDefs = providerConfig.models ?? []
    if (modelDefs.length === 0) {
      continue
    }

    let builtInDefaults: { api: string; baseUrl: string } | undefined
    if (builtInProviders.has(providerName as KnownProvider)) {
      const builtIn = getModels(providerName as KnownProvider) as Model<Api>[]
      if (builtIn.length > 0) {
        builtInDefaults = { api: builtIn[0].api, baseUrl: builtIn[0].baseUrl }
      }
    }

    for (const modelDef of modelDefs) {
      const api = modelDef.api ?? providerConfig.api ?? builtInDefaults?.api
      const baseUrl = modelDef.baseUrl ?? providerConfig.baseUrl ?? builtInDefaults?.baseUrl
      if (!api || !baseUrl || !modelDef.id) {
        continue
      }

      models.push({
        id: modelDef.id,
        name: modelDef.name ?? modelDef.id,
        api: api as Api,
        provider: providerName,
        baseUrl,
        reasoning: modelDef.reasoning ?? false,
        input: ['text'],
        cost: DEFAULT_COST,
        contextWindow: 128000,
        maxTokens: 16384,
      } as Model<Api>)
    }
  }

  return models
}

export class MuseModelService {
  private auth: AuthStorageData = {}
  private customModels: Model<Api>[] = []
  private providerApiKeys = new Map<string, string>()

  async reload(): Promise<void> {
    this.auth = await readAuthData(getAuthPath())
    const modelsConfig = (await readJsonFileIfExists<MuseModelsConfig>(getModelsPath())) ?? {
      providers: {},
    }

    this.customModels = parseCustomModels(modelsConfig)
    this.providerApiKeys.clear()

    for (const [providerName, providerConfig] of Object.entries(modelsConfig.providers ?? {})) {
      if (typeof providerConfig.apiKey === 'string' && providerConfig.apiKey.length > 0) {
        this.providerApiKeys.set(providerName, providerConfig.apiKey)
      }
    }
  }

  getAllModels(): Model<Api>[] {
    const builtIn = getProviders().flatMap((provider) => getModels(provider) as Model<Api>[])
    const byKey = new Map<string, Model<Api>>()
    for (const model of [...builtIn, ...this.customModels]) {
      byKey.set(`${model.provider}:${model.id}`, model)
    }
    return [...byKey.values()]
  }

  findModel(provider: string, modelId: string): Model<Api> | undefined {
    return this.getAllModels().find((model) => model.provider === provider && model.id === modelId)
  }

  resolveModel(config: AgentInstanceConfig): Model<Api> {
    const provider =
      config.defaultProvider ??
      process.env.MUSE_DEFAULT_PROVIDER ??
      ''
    const modelId =
      config.defaultModel ??
      process.env.MUSE_DEFAULT_MODEL ??
      ''

    if (!provider || !modelId) {
      throw new Error(
        '未配置模型：请在 agents/<id>/config.json 设置 defaultProvider / defaultModel，或设置环境变量 MUSE_DEFAULT_PROVIDER / MUSE_DEFAULT_MODEL',
      )
    }

    const model = this.findModel(provider, modelId)
    if (!model) {
      throw new Error(`未找到模型: ${provider}/${modelId}`)
    }

    if (!this.getApiKey(provider)) {
      throw new Error(
        `Provider "${provider}" 未配置凭证：请在 auth.json 写入 api_key，或设置对应环境变量`,
      )
    }

    return model
  }

  getApiKey(provider: string): string | undefined {
    const stored = this.auth[provider]
    if (stored?.type === 'api_key' && stored.key) {
      return stored.key
    }

    const fromEnv = getEnvApiKey(provider)
    if (fromEnv) {
      return fromEnv
    }

    return this.providerApiKeys.get(provider)
  }
}

export const museModelService = new MuseModelService()
