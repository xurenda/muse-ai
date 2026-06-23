import { z } from 'zod'
import type { ProviderAdvancedConfig } from './provider-advanced.js'

/** 凭证配置状态（Backend 仅存 DB，无 env 回退） */
export type ProviderAuthStatus = 'configured' | 'missing'

export type ProviderHealthStatus = 'missing' | 'ready' | 'broken'

export interface ProviderModelOption {
  id: string
  name: string
  /** 内置模型 catalog 已知时提供；自定义模型省略 */
  contextWindow?: number
}

/** GET /settings/models-config */
export interface ModelsConfigResponse {
  agentId: string
  defaultProvider?: string
  defaultModel?: string
  options: ModelsConfigProviderOption[]
}

export interface ModelsConfigProviderOption {
  id: string
  name: string
  authStatus: ProviderAuthStatus
  models: ProviderModelOption[]
}

/** PATCH /settings/models-config */
export const updateModelsConfigRequestSchema = z.object({
  defaultProvider: z.string().min(1),
  defaultModel: z.string().min(1),
})

export interface UpdateModelsConfigRequest {
  defaultProvider: string
  defaultModel: string
}

export interface ApiKeyProviderItem {
  id: string
  name: string
  authStatus: ProviderAuthStatus
  healthStatus: ProviderHealthStatus
  healthMessage?: string
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
export const updateProviderApiKeyRequestSchema = z.object({
  apiKey: z.string().min(1),
})

export interface UpdateProviderApiKeyRequest {
  apiKey: string
}

/** PUT /settings/providers/custom/:id */
export const upsertCustomProviderRequestSchema = z.object({
  baseUrl: z.string().url(),
  api: z.string().min(1),
  apiKey: z.string().min(1),
  headers: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  models: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        headers: z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .min(1),
})

export type UpsertCustomProviderRequest = z.infer<typeof upsertCustomProviderRequestSchema>

export const upsertProviderAdvancedConfigRequestSchema = z.object({
  baseUrl: z.string().optional(),
  headers: z
    .array(
      z.object({
        key: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  extraModels: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        headers: z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
})

export type UpsertProviderAdvancedConfigRequest = z.infer<typeof upsertProviderAdvancedConfigRequestSchema>
