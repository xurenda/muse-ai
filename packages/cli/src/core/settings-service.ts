import { findEnvKeys, getEnvApiKey, getModels, getProviders, type KnownProvider } from '@earendil-works/pi-ai'
import {
  API_KEY_PROVIDER_IDS,
  DEFAULT_AGENT_ID,
  maskApiKey,
  PROVIDER_DISPLAY_NAMES,
  type ModelsConfigResponse,
  type ProviderAuthStatus,
  type ProvidersConfigResponse,
  type UpdateModelsConfigRequest,
  type UpsertCustomProviderRequest,
  type UpsertProviderAdvancedConfigRequest,
} from '@muse-ai/shared'
import { getAgentConfigPath } from '../data/paths'
import { loadAgentInstanceConfig } from './agent-factory'
import { removeProviderApiKey, setProviderApiKey } from './auth-store'
import { readJsonFile } from './read-json-file'
import { writeJsonFile } from './write-json-file'
import {
  clearProviderAuthFailure,
  getProviderAuthFailureMessage,
  getProviderHealth,
} from './provider-health'
import { museModelService } from './model-service'
import {
  providerConfigToAdvanced,
  readModelsStore,
  removeCustomProvider,
  upsertBuiltinProviderAdvanced,
  upsertCustomProvider,
} from './models-store'
import type { AgentInstanceConfig } from '@muse-ai/shared'

function getProviderDisplayName(providerId: string): string {
  return PROVIDER_DISPLAY_NAMES[providerId] ?? providerId
}

function getAuthStatus(providerId: string): ProviderAuthStatus {
  const stored = museModelService.getStoredAuthType(providerId)
  if (stored === 'api_key') {
    return 'configured'
  }

  const envKey = getEnvApiKey(providerId)
  if (envKey) {
    return 'env'
  }

  if (museModelService.getModelsJsonApiKey(providerId)) {
    return 'configured'
  }

  return 'missing'
}

function isConfigured(providerId: string): boolean {
  return getAuthStatus(providerId) !== 'missing'
}

function listProviderModels(providerId: string, modelsStore: Awaited<ReturnType<typeof readModelsStore>>) {
  const builtIn = getProviders().includes(providerId as KnownProvider)
    ? (getModels(providerId as KnownProvider) as Array<{ id: string; name?: string }>).map(
        (model) => ({
          id: model.id,
          name: model.name ?? model.id,
        }),
      )
    : []

  const custom = (modelsStore.providers?.[providerId]?.models ?? []).map((model) => ({
    id: model.id,
    name: model.name ?? model.id,
  }))

  const byId = new Map<string, { id: string; name: string }>()
  for (const model of [...builtIn, ...custom]) {
    byId.set(model.id, { id: model.id, name: model.name })
  }
  return [...byId.values()]
}

export async function getModelsConfig(): Promise<ModelsConfigResponse> {
  await museModelService.reload()
  const agentConfig = await loadAgentInstanceConfig(DEFAULT_AGENT_ID)

  const configuredProviderIds = new Set<string>()
  for (const providerId of API_KEY_PROVIDER_IDS) {
    if (isConfigured(providerId)) {
      configuredProviderIds.add(providerId)
    }
  }

  const modelsStore = await readModelsStore()
  for (const providerId of Object.keys(modelsStore.providers ?? {})) {
    if (isConfigured(providerId)) {
      configuredProviderIds.add(providerId)
    }
  }

  const options = [...configuredProviderIds].map((providerId) => {
    const models = listProviderModels(providerId, modelsStore)

    return {
      id: providerId,
      name: getProviderDisplayName(providerId),
      authStatus: getAuthStatus(providerId),
      models,
    }
  })

  return {
    agentId: DEFAULT_AGENT_ID,
    defaultProvider: agentConfig.defaultProvider,
    defaultModel: agentConfig.defaultModel,
    options: options.sort((left, right) => left.name.localeCompare(right.name)),
  }
}

export async function updateModelsConfig(input: UpdateModelsConfigRequest): Promise<void> {
  await museModelService.reload()

  if (!isConfigured(input.defaultProvider)) {
    throw new Error(`Provider "${input.defaultProvider}" 尚未配置凭证`)
  }

  const model = museModelService.findModel(input.defaultProvider, input.defaultModel)
  if (!model) {
    throw new Error(`未找到模型: ${input.defaultProvider}/${input.defaultModel}`)
  }

  const current = await readJsonFile<AgentInstanceConfig>(getAgentConfigPath(DEFAULT_AGENT_ID))
  const next: AgentInstanceConfig = {
    ...current,
    defaultProvider: input.defaultProvider,
    defaultModel: input.defaultModel,
  }
  await writeJsonFile(getAgentConfigPath(DEFAULT_AGENT_ID), next)
}

export async function getProvidersConfig(): Promise<ProvidersConfigResponse> {
  await museModelService.reload()
  const modelsStore = await readModelsStore()
  const builtInIds = new Set<string>(getProviders())

  const apiKeyProviders = API_KEY_PROVIDER_IDS.map((providerId) => {
    const healthStatus = getProviderHealth(providerId)
    const healthMessage =
      healthStatus === 'broken' ? getProviderAuthFailureMessage(providerId) : undefined

    const providerConfig = modelsStore.providers?.[providerId]
    const authStatus = getAuthStatus(providerId)
    const apiKey = authStatus !== 'missing' ? museModelService.getApiKey(providerId) : undefined

    return {
      id: providerId,
      name: getProviderDisplayName(providerId),
      authStatus,
      healthStatus,
      healthMessage,
      envKeys: findEnvKeys(providerId as KnownProvider),
      apiKeyMask: apiKey ? maskApiKey(apiKey) : undefined,
      advanced: providerConfigToAdvanced(providerConfig),
    }
  })

  const customProviders = Object.entries(modelsStore.providers ?? {})
    .filter(([providerId]) => !builtInIds.has(providerId))
    .map(([providerId, providerConfig]) => ({
      id: providerId,
      baseUrl: providerConfig.baseUrl ?? '',
      api: providerConfig.api ?? 'openai-completions',
      apiKey: providerConfig.apiKey,
      headers: providerConfigToAdvanced(providerConfig).headers,
      models: (providerConfig.models ?? []).map((model) => ({
        id: model.id,
        name: model.name ?? model.id,
        headers: providerConfigToAdvanced({ models: [model] }).extraModels[0]?.headers ?? [],
      })),
    }))
    .sort((left, right) => left.id.localeCompare(right.id))

  return { apiKeyProviders, customProviders }
}

export async function saveProviderApiKey(providerId: string, apiKey: string): Promise<void> {
  if (!apiKey.trim()) {
    throw new Error('API Key 不能为空')
  }
  await setProviderApiKey(providerId, apiKey)
  clearProviderAuthFailure(providerId)
  await museModelService.reload()
}

export async function deleteProviderApiKey(providerId: string): Promise<void> {
  await removeProviderApiKey(providerId)
  clearProviderAuthFailure(providerId)
  await museModelService.reload()
}

export async function saveCustomProvider(
  providerId: string,
  input: UpsertCustomProviderRequest,
): Promise<void> {
  const normalizedId = providerId.trim()
  if (!normalizedId) {
    throw new Error('Provider ID 不能为空')
  }
  if (!input.baseUrl.trim()) {
    throw new Error('Base URL 不能为空')
  }
  if (!input.models.length) {
    throw new Error('至少添加一个模型')
  }

  await upsertCustomProvider(normalizedId, {
    baseUrl: input.baseUrl.trim(),
    api: input.api,
    apiKey: input.apiKey,
    headers: input.headers,
    models: input.models,
  })
  await museModelService.reload()
}

export async function saveBuiltinProviderAdvanced(
  providerId: string,
  input: UpsertProviderAdvancedConfigRequest,
): Promise<void> {
  if (!API_KEY_PROVIDER_IDS.includes(providerId as (typeof API_KEY_PROVIDER_IDS)[number])) {
    throw new Error(`不支持的供应方: ${providerId}`)
  }

  await upsertBuiltinProviderAdvanced(providerId, input)
  await museModelService.reload()
}

export async function deleteCustomProvider(providerId: string): Promise<void> {
  await removeCustomProvider(providerId)
  await museModelService.reload()
}
