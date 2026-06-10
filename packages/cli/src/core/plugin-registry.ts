import {
  DEFAULT_AGENT_ID,
  pluginInstallRelativePath,
  type AgentResourceEnableList,
  type RegistryEntry,
  type RegistryFile,
} from '@muse-ai/shared'
import { getAgentPluginsPath, getRegistryPluginsPath } from '../data/paths'
import { readJsonFileIfExists } from './read-json-file'
import { writeJsonFile } from './write-json-file'

export async function upsertPluginRegistryEntry(entry: Omit<RegistryEntry, 'installedAt'> & { installedAt?: string }): Promise<RegistryEntry> {
  const registryPath = getRegistryPluginsPath()
  const registry = (await readJsonFileIfExists<RegistryFile>(registryPath)) ?? { items: [] }
  const installedAt = entry.installedAt ?? new Date().toISOString()
  const nextEntry: RegistryEntry = {
    id: entry.id,
    path: entry.path,
    version: entry.version,
    installedAt,
  }

  const existingIndex = registry.items.findIndex((item) => item.id === entry.id)
  if (existingIndex >= 0) {
    registry.items[existingIndex] = nextEntry
  } else {
    registry.items.push(nextEntry)
  }

  await writeJsonFile(registryPath, registry)
  return nextEntry
}

export async function enablePluginForAgent(pluginId: string, agentId = DEFAULT_AGENT_ID): Promise<boolean> {
  const pluginsPath = getAgentPluginsPath(agentId)
  const current = (await readJsonFileIfExists<AgentResourceEnableList>(pluginsPath)) ?? { enabled: [] }
  if (current.enabled.includes(pluginId)) {
    return false
  }

  await writeJsonFile(pluginsPath, {
    enabled: [...current.enabled, pluginId],
  })
  return true
}

export function buildPluginRegistryEntry(pluginId: string, version?: string): RegistryEntry {
  return {
    id: pluginId,
    path: pluginInstallRelativePath(pluginId),
    version,
    installedAt: new Date().toISOString(),
  }
}
