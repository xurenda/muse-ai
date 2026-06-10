export interface ProviderHeaderEntry {
  key: string
  value: string
}

export interface ProviderExtraModelEntry {
  id: string
  name: string
  headers: ProviderHeaderEntry[]
}

/** 内置供应方在 models.json 中的高级配置（UI 形态） */
export interface ProviderAdvancedConfig {
  baseUrl?: string
  headers: ProviderHeaderEntry[]
  extraModels: ProviderExtraModelEntry[]
}

/** PUT /settings/providers/:id/advanced-config */
export interface UpsertProviderAdvancedConfigRequest {
  baseUrl?: string
  headers?: ProviderHeaderEntry[]
  extraModels?: Array<{
    id: string
    name?: string
    headers?: ProviderHeaderEntry[]
  }>
}
