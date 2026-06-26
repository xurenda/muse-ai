import { MuseAgentRegistry } from '@museai/core'
import type { AgentDefinition, MarketAsset } from '@museai/shared'
import { createAssetRoots, type MusePaths } from '../paths.js'

/** 查找仍引用即将卸载资产的 Agent */
export async function findAgentsReferencingPackageAssets(paths: MusePaths, assets: MarketAsset[]): Promise<AgentDefinition[]> {
  const personaIds = new Set(assets.filter(asset => asset.type === 'persona').map(asset => asset.id))
  const skillIds = new Set(assets.filter(asset => asset.type === 'skill').map(asset => asset.id))

  if (personaIds.size === 0 && skillIds.size === 0) {
    return []
  }

  const registry = new MuseAgentRegistry({
    roots: createAssetRoots(paths),
    cwd: paths.home,
  })
  const agents = await registry.listAgents()

  return agents.filter(agent => {
    if (personaIds.has(agent.personaId)) return true
    return agent.skillIds.some(skillId => skillIds.has(skillId))
  })
}
