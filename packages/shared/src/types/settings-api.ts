import type { ProviderAdvancedConfig } from './provider-advanced'

/** 凭证配置状态 */
export type ProviderAuthStatus = 'configured' | 'env' | 'missing'

/** 供应方可用性（设置页指示器） */
export type ProviderHealthStatus = 'missing' | 'ready' | 'broken'

export interface ProviderModelOption {
  id: string
  name: string
}

/** GET /settings/models-config */
export interface ModelsConfigResponse {
  agentId: string
  defaultProvider?: string
  defaultModel?: string
  /** 已配置凭证的 provider 及其模型列表 */
  options: ModelsConfigProviderOption[]
}

export interface ModelsConfigProviderOption {
  id: string
  name: string
  authStatus: ProviderAuthStatus
  models: ProviderModelOption[]
}

/** PATCH /settings/models-config */
export interface UpdateModelsConfigRequest {
  defaultProvider: string
  defaultModel: string
}

export interface ApiKeyProviderItem {
  id: string
  name: string
  authStatus: ProviderAuthStatus
  healthStatus: ProviderHealthStatus
  /** healthStatus 为 broken 时的说明（对话失败原因或静态解析失败） */
  healthMessage?: string
  envKeys?: string[]
  /** 已配置时用于输入框 placeholder 的掩码展示，不含完整密钥 */
  apiKeyMask?: string
  advanced?: ProviderAdvancedConfig
}

export interface CustomProviderItem {
  id: string
  baseUrl: string
  api: string
  apiKey?: string
  headers: Array<{ key: string; value: string }>
  models: Array<ProviderModelOption & { headers: Array<{ key: string; value: string }> }>
}

/** GET /settings/providers */
export interface ProvidersConfigResponse {
  apiKeyProviders: ApiKeyProviderItem[]
  customProviders: CustomProviderItem[]
}

/** PUT /settings/providers/:id/api-key */
export interface UpdateProviderApiKeyRequest {
  apiKey: string
}

/** PUT /settings/providers/custom/:id */
export interface UpsertCustomProviderRequest {
  baseUrl: string
  api: string
  apiKey?: string
  headers?: Array<{ key: string; value: string }>
  models: Array<{ id: string; name?: string; headers?: Array<{ key: string; value: string }> }>
}
