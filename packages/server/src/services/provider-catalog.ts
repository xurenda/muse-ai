import { getModels, getProviders, type Api, type KnownProvider, type Model } from '@earendil-works/pi-ai'
import type { MuseModelsConfig, MuseProviderDefinition } from '@muse-ai/shared'
import { DEFAULT_PROVIDER_API } from '@muse-ai/shared'
import { mergeHeaderRecords } from '../utils/header-utils.js'

const DEFAULT_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

function parseCustomModels(config: MuseModelsConfig): Model<Api>[] {
  const models: Model<Api>[] = []
  const providers = config.providers ?? {}
  const builtInProviders = new Set(getProviders())

  for (const [providerName, providerConfig] of Object.entries(providers)) {
    const modelDefs = providerConfig.models ?? []
    if (modelDefs.length === 0) continue

    let builtInDefaults: { api: string; baseUrl: string } | undefined
    if (builtInProviders.has(providerName as KnownProvider)) {
      const builtIn = getModels(providerName as KnownProvider) as Model<Api>[]
      const first = builtIn[0]
      if (first) {
        builtInDefaults = { api: first.api, baseUrl: first.baseUrl }
      }
    }

    const providerHeaders = providerConfig.headers

    for (const modelDef of modelDefs) {
      const api = modelDef.api ?? providerConfig.api ?? builtInDefaults?.api
      const baseUrl = modelDef.baseUrl ?? providerConfig.baseUrl ?? builtInDefaults?.baseUrl
      if (!api || !baseUrl || !modelDef.id) continue

      models.push({
        id: modelDef.id,
        name: modelDef.name ?? modelDef.id,
        api: api as Api,
        provider: providerName,
        baseUrl,
        reasoning: modelDef.reasoning ?? false,
        input: ['text'],
        cost: DEFAULT_COST,
        contextWindow: 128_000,
        maxTokens: 16_384,
        headers: mergeHeaderRecords(providerHeaders, modelDef.headers),
      } as Model<Api>)
    }
  }

  return models
}

export function listBuiltInModels(config: MuseModelsConfig): Model<Api>[] {
  const providerConfigs = config.providers ?? {}

  const builtIn = getProviders().flatMap(provider => {
    const builtInModels = getModels(provider as KnownProvider) as Model<Api>[]
    const providerConfig = providerConfigs[provider]
    const baseUrlOverride = providerConfig?.baseUrl?.trim()
    const providerHeaders = providerConfig?.headers

    return builtInModels.map(model => ({
      ...model,
      baseUrl: baseUrlOverride || model.baseUrl,
      headers: mergeHeaderRecords(model.headers as Record<string, string> | undefined, providerHeaders),
    }))
  })

  const custom = parseCustomModels(config)
  const byKey = new Map<string, Model<Api>>()
  for (const model of [...builtIn, ...custom]) {
    byKey.set(`${model.provider}:${model.id}`, model)
  }
  return [...byKey.values()]
}

export function findCatalogModel(config: MuseModelsConfig, provider: string, modelId: string): Model<Api> | undefined {
  return listBuiltInModels(config).find(model => model.provider === provider && model.id === modelId)
}

export function isBuiltInProvider(providerId: string): boolean {
  return getProviders().includes(providerId as KnownProvider)
}

export function resolveProviderBaseUrl(providerId: string, override?: MuseProviderDefinition): string | undefined {
  if (override?.baseUrl?.trim()) {
    return override.baseUrl.trim()
  }

  if (isBuiltInProvider(providerId)) {
    const models = getModels(providerId as KnownProvider) as Model<Api>[]
    return models[0]?.baseUrl
  }

  return override?.baseUrl
}

export function resolveProviderApi(providerId: string, override?: MuseProviderDefinition): string {
  if (override?.api?.trim()) {
    return override.api.trim()
  }

  if (isBuiltInProvider(providerId)) {
    const models = getModels(providerId as KnownProvider) as Model<Api>[]
    return models[0]?.api ?? DEFAULT_PROVIDER_API
  }

  return DEFAULT_PROVIDER_API
}

export function listProviderModelOptions(providerId: string, config: MuseModelsConfig): Array<{ id: string; name: string }> {
  const builtIn = isBuiltInProvider(providerId)
    ? (getModels(providerId as KnownProvider) as Array<{ id: string; name?: string }>).map(model => ({
        id: model.id,
        name: model.name ?? model.id,
      }))
    : []

  const custom = (config.providers?.[providerId]?.models ?? []).map(model => ({
    id: model.id,
    name: model.name ?? model.id,
  }))

  const byId = new Map<string, { id: string; name: string }>()
  for (const model of [...builtIn, ...custom]) {
    byId.set(model.id, { id: model.id, name: model.name })
  }
  return [...byId.values()]
}
