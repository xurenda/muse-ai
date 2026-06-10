/** models.json 中的单个模型定义（第一版最小字段，后续对齐 pi） */
export interface MuseModelDefinition {
  id: string
  name?: string
  reasoning?: boolean
  [key: string]: unknown
}

/** models.json 中的 provider 定义 */
export interface MuseProviderDefinition {
  baseUrl?: string
  api?: string
  apiKey?: string
  models?: MuseModelDefinition[]
  [key: string]: unknown
}

/** models.json 根结构 */
export interface MuseModelsConfig {
  providers?: Record<string, MuseProviderDefinition>
}
