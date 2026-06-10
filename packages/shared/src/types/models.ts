/** models.json 中的单个模型定义 */
export interface MuseModelDefinition {
  id: string
  name?: string
  reasoning?: boolean
  baseUrl?: string
  api?: string
  headers?: Record<string, string>
}

/** models.json 中的 provider 定义 */
export interface MuseProviderDefinition {
  baseUrl?: string
  api?: string
  apiKey?: string
  headers?: Record<string, string>
  models?: MuseModelDefinition[]
}

/** models.json 根结构 */
export interface MuseModelsConfig {
  providers?: Record<string, MuseProviderDefinition>
}
