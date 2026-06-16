import { eq } from 'drizzle-orm'
import { getProviders } from '@earendil-works/pi-ai'
import {
  API_KEY_PROVIDER_IDS,
  DEFAULT_AGENT_ID,
  maskApiKey,
  PROVIDER_DISPLAY_NAMES,
  type ApiKeyCredential,
  type AuthCredential,
  type ModelsConfigResponse,
  type ProviderAuthStatus,
  type ProvidersConfigResponse,
  type UpdateModelsConfigRequest,
  type UpsertCustomProviderRequest,
  type UpsertProviderAdvancedConfigRequest,
} from '@muse-ai/shared'
import type { MuseDb } from '../db/client.js'
import { userSettings } from '../db/schema.js'
import type { CredentialStore } from '../stores/credential-store.js'
import { providerConfigToAdvanced, ProviderConfigStore } from '../stores/provider-config-store.js'
import { findCatalogModel, isBuiltInProvider, listProviderModelOptions } from './provider-catalog.js'
import { clearProviderAuthFailure, getProviderAuthFailureMessage, getProviderHealth } from './provider-health.js'

export class SettingsService {
  private readonly configStore: ProviderConfigStore

  constructor(
    private readonly db: MuseDb,
    private readonly credentialStore: CredentialStore,
  ) {
    this.configStore = new ProviderConfigStore(db)
  }

  private getProviderDisplayName(providerId: string): string {
    return PROVIDER_DISPLAY_NAMES[providerId] ?? providerId
  }

  private async hasCredential(userId: string, providerId: string): Promise<boolean> {
    const credential = await this.credentialStore.get(userId, providerId)
    return Boolean(this.extractApiKey(credential))
  }

  private extractApiKey(credential: AuthCredential | undefined): string | undefined {
    if (!credential) return undefined
    if (credential.type === 'api_key' && credential.key.trim()) {
      return credential.key.trim()
    }
    // OAuth 后续接入 getOAuthApiKey
    return undefined
  }

  private async getAuthStatus(userId: string, providerId: string): Promise<ProviderAuthStatus> {
    return (await this.isConfigured(userId, providerId)) ? 'configured' : 'missing'
  }

  private async isConfigured(userId: string, providerId: string): Promise<boolean> {
    return this.hasCredential(userId, providerId)
  }

  async getModelsConfig(userId: string): Promise<ModelsConfigResponse> {
    const modelsStore = await this.configStore.readAll(userId)
    const [settings] = await this.db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1)

    const configuredProviderIds = new Set<string>()
    for (const providerId of API_KEY_PROVIDER_IDS) {
      if (await this.isConfigured(userId, providerId)) {
        configuredProviderIds.add(providerId)
      }
    }

    for (const providerId of Object.keys(modelsStore.providers ?? {})) {
      if (await this.isConfigured(userId, providerId)) {
        configuredProviderIds.add(providerId)
      }
    }

    const options = [...configuredProviderIds].map(providerId => ({
      id: providerId,
      name: this.getProviderDisplayName(providerId),
      authStatus: 'configured' as const,
      models: listProviderModelOptions(providerId, modelsStore),
    }))

    return {
      agentId: DEFAULT_AGENT_ID,
      defaultProvider: settings?.defaultProvider ?? undefined,
      defaultModel: settings?.defaultModel ?? undefined,
      options: options.sort((left, right) => left.name.localeCompare(right.name)),
    }
  }

  async updateModelsConfig(userId: string, input: UpdateModelsConfigRequest): Promise<void> {
    if (!(await this.isConfigured(userId, input.defaultProvider))) {
      throw new SettingsError('not_configured', `Provider "${input.defaultProvider}" 尚未配置凭证`)
    }

    const modelsStore = await this.configStore.readAll(userId)
    const model = findCatalogModel(modelsStore, input.defaultProvider, input.defaultModel)
    if (!model) {
      throw new SettingsError('model_not_found', `未找到模型: ${input.defaultProvider}/${input.defaultModel}`)
    }

    const now = new Date().toISOString()
    await this.db
      .insert(userSettings)
      .values({
        userId,
        defaultProvider: input.defaultProvider,
        defaultModel: input.defaultModel,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          defaultProvider: input.defaultProvider,
          defaultModel: input.defaultModel,
          updatedAt: now,
        },
      })
  }

  async getProvidersConfig(userId: string): Promise<ProvidersConfigResponse> {
    const modelsStore = await this.configStore.readAll(userId)
    const builtInIds = new Set<string>(getProviders())

    const apiKeyProviders = await Promise.all(
      API_KEY_PROVIDER_IDS.map(async providerId => {
        const authStatus = await this.getAuthStatus(userId, providerId)
        const hasCredential = authStatus === 'configured'
        const healthStatus = getProviderHealth(userId, providerId, hasCredential)
        const healthMessage = healthStatus === 'broken' ? getProviderAuthFailureMessage(userId, providerId) : undefined
        const providerConfig = modelsStore.providers?.[providerId]
        const credential = await this.credentialStore.get(userId, providerId)
        const apiKey = this.extractApiKey(credential)

        return {
          id: providerId,
          name: this.getProviderDisplayName(providerId),
          authStatus,
          healthStatus,
          healthMessage,
          apiKeyMask: apiKey ? maskApiKey(apiKey) : undefined,
          advanced: providerConfigToAdvanced(providerConfig),
        }
      }),
    )

    const customProviders = Object.entries(modelsStore.providers ?? {})
      .filter(([providerId]) => !builtInIds.has(providerId))
      .map(([providerId, providerConfig]) => ({
        id: providerId,
        baseUrl: providerConfig.baseUrl ?? '',
        api: providerConfig.api ?? 'openai-completions',
        apiKey: undefined,
        headers: providerConfigToAdvanced(providerConfig).headers,
        models: (providerConfig.models ?? []).map(model => ({
          id: model.id,
          name: model.name ?? model.id,
          headers: providerConfigToAdvanced({ models: [model] }).extraModels[0]?.headers ?? [],
        })),
      }))
      .sort((left, right) => left.id.localeCompare(right.id))

    return { apiKeyProviders, customProviders }
  }

  async saveProviderApiKey(userId: string, providerId: string, apiKey: string): Promise<void> {
    if (!apiKey.trim()) {
      throw new SettingsError('invalid_request', 'API Key 不能为空')
    }

    const credential: ApiKeyCredential = { type: 'api_key', key: apiKey.trim() }
    await this.credentialStore.set(userId, providerId, credential)
    clearProviderAuthFailure(userId, providerId)
  }

  async deleteProviderApiKey(userId: string, providerId: string): Promise<void> {
    await this.credentialStore.remove(userId, providerId)
    clearProviderAuthFailure(userId, providerId)
  }

  async saveBuiltinProviderAdvanced(userId: string, providerId: string, input: UpsertProviderAdvancedConfigRequest): Promise<void> {
    if (!API_KEY_PROVIDER_IDS.includes(providerId as (typeof API_KEY_PROVIDER_IDS)[number])) {
      throw new SettingsError('invalid_request', `不支持的供应方: ${providerId}`)
    }
    await this.configStore.upsertBuiltinAdvanced(userId, providerId, input)
  }

  async saveCustomProvider(userId: string, providerId: string, input: UpsertCustomProviderRequest): Promise<void> {
    const normalizedId = providerId.trim()
    if (!normalizedId) {
      throw new SettingsError('invalid_request', 'Provider ID 不能为空')
    }
    if (!input.baseUrl.trim()) {
      throw new SettingsError('invalid_request', 'Base URL 不能为空')
    }
    if (!input.models.length) {
      throw new SettingsError('invalid_request', '至少添加一个模型')
    }
    if (!input.apiKey.trim()) {
      throw new SettingsError('invalid_request', 'API Key 不能为空')
    }

    await this.configStore.upsertCustom(userId, normalizedId, input)
    await this.saveProviderApiKey(userId, normalizedId, input.apiKey.trim())
  }

  async deleteCustomProvider(userId: string, providerId: string): Promise<void> {
    await this.configStore.removeCustom(userId, providerId)
    await this.credentialStore.remove(userId, providerId)
  }

  async readModelsStore(userId: string) {
    return this.configStore.readAll(userId)
  }

  async readCredential(userId: string, providerId: string) {
    return this.credentialStore.get(userId, providerId)
  }
}

export class SettingsError extends Error {
  constructor(
    readonly code: 'invalid_request' | 'not_configured' | 'model_not_found' | 'no_provider',
    message: string,
  ) {
    super(message)
    this.name = 'SettingsError'
  }
}

export { isBuiltInProvider }
