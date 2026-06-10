/** agents/<id>/config.json */
export interface AgentInstanceConfig {
  id: string
  name: string
  description?: string
  defaultProvider?: string
  defaultModel?: string
}

/** agents/<id>/plugins.json | skills.json | prompts.json */
export interface AgentResourceEnableList {
  enabled: string[]
}
