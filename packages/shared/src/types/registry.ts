/** registry/*.json 中的单条安装记录 */
export interface RegistryEntry {
  id: string
  path: string
  installedAt: string
  version?: string
}

/** registry/plugins.json 等文件的统一结构 */
export interface RegistryFile {
  items: RegistryEntry[]
}

/** registry/agents.json：市场 Agent 包与本地实例的映射（可选） */
export interface AgentRegistryEntry extends RegistryEntry {
  /** 本地 Agent 实例 id，对应 agents/<agentId>/ */
  agentId: string
}

export interface AgentRegistryFile {
  items: AgentRegistryEntry[]
}
