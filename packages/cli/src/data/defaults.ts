import {
  DEFAULT_AGENT_ID,
  OFFICIAL_BASIC_PLUGIN_ID,
  type AgentInstanceConfig,
  type AgentRegistryFile,
  type AgentResourceEnableList,
  type AuthStorageData,
  type MuseModelsConfig,
  type MuseSettings,
  type RegistryFile,
} from '@muse-ai/shared'

export const DEFAULT_SETTINGS: MuseSettings = {
  locale: 'zh-CN',
}

export const DEFAULT_AUTH: AuthStorageData = {}

export const DEFAULT_MODELS: MuseModelsConfig = {
  providers: {},
}

export const EMPTY_REGISTRY: RegistryFile = {
  items: [],
}

export const EMPTY_AGENT_REGISTRY: AgentRegistryFile = {
  items: [],
}

export const EMPTY_ENABLE_LIST: AgentResourceEnableList = {
  enabled: [],
}

export const DEFAULT_AGENT_PLUGINS: AgentResourceEnableList = {
  enabled: [OFFICIAL_BASIC_PLUGIN_ID],
}

export const DEFAULT_AGENT_CONFIG: AgentInstanceConfig = {
  id: DEFAULT_AGENT_ID,
  name: 'Default',
  description: '默认 Agent 实例',
}

export const DEFAULT_AGENT_SYSTEM = `你是一个有帮助的 AI 助手。

请用清晰、准确的语言回答用户问题。`
