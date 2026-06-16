/** 用户 provider 配置（等同 models.json 中的单个 provider） */
export interface MuseModelDefinition {
  id: string
  name?: string
  reasoning?: boolean
  baseUrl?: string
  api?: string
  headers?: Record<string, string>
}

export interface MuseProviderDefinition {
  baseUrl?: string
  api?: string
  apiKey?: string
  headers?: Record<string, string>
  models?: MuseModelDefinition[]
}

export interface MuseModelsConfig {
  providers?: Record<string, MuseProviderDefinition>
}
