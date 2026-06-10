import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { join } from 'node:path'
import type { AgentTool } from '@earendil-works/pi-agent-core'
import type { ToolDefinition } from '@earendil-works/pi-coding-agent'
import {
  pluginInstallRelativePath,
  resolvePluginManifestEntry,
  type AgentResourceEnableList,
  type RegistryFile,
} from '@muse-ai/shared'
import { getAgentPluginsPath, getMuseHomeDir, getRegistryPluginsPath } from '../data/paths'
import { loadExtensionTools } from './plugin-extension-loader'
import { readPluginManifestFromDir } from './plugin-manifest'
import { readJsonFileIfExists } from './read-json-file'
import { resolvePluginRoot } from './resolve-plugin-root'
import { wrapToolDefinitionsForCwd } from './wrap-tool-definition'

export interface LoadAgentToolsResult {
  tools: AgentTool[]
  warnings: string[]
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function readEnabledPluginIds(agentId: string): Promise<string[]> {
  const enableList = await readJsonFileIfExists<AgentResourceEnableList>(getAgentPluginsPath(agentId))
  return enableList?.enabled ?? []
}

async function resolveExtensionAbsolutePaths(pluginId: string): Promise<string[]> {
  const pluginRoot = await resolvePluginRoot(pluginId)
  if (!pluginRoot) {
    return []
  }

  const manifest = await readPluginManifestFromDir(pluginRoot)
  if (manifest.id !== pluginId) {
    throw new Error(`Plugin manifest id 不匹配: 期望 ${pluginId}，实际 ${manifest.id}`)
  }

  const registry = await readJsonFileIfExists<RegistryFile>(getRegistryPluginsPath())
  const registryEntry = registry?.items.find((item) => item.id === pluginId)
  const installRelativePath = registryEntry?.path ?? pluginInstallRelativePath(pluginId)

  const paths: string[] = []
  for (const entry of manifest.extensions) {
    const relativePath = resolvePluginManifestEntry(installRelativePath, entry)
    paths.push(join(getMuseHomeDir(), relativePath))
  }
  return paths
}

function dedupeToolDefinitions(definitions: ToolDefinition[]): ToolDefinition[] {
  const byName = new Map<string, ToolDefinition>()
  for (const definition of definitions) {
    byName.set(definition.name, definition)
  }
  return [...byName.values()]
}

export async function loadAgentTools(options: {
  agentId: string
  cwd: string
}): Promise<LoadAgentToolsResult> {
  const sessionCwd = options.cwd.trim() || process.cwd()
  const warnings: string[] = []
  const toolDefinitions: ToolDefinition[] = []
  const enabledPluginIds = await readEnabledPluginIds(options.agentId)

  for (const pluginId of enabledPluginIds) {
    const pluginRoot = await resolvePluginRoot(pluginId)
    if (!pluginRoot) {
      warnings.push(`Plugin 未安装或缺少 manifest: ${pluginId}`)
      continue
    }

    const extensionPaths = await resolveExtensionAbsolutePaths(pluginId)
    if (extensionPaths.length === 0) {
      warnings.push(`Plugin 未声明 extensions: ${pluginId}`)
      continue
    }

    for (const extensionPath of extensionPaths) {
      if (!(await pathExists(extensionPath))) {
        warnings.push(`Extension 文件不存在: ${extensionPath}`)
        continue
      }

      try {
        const tools = await loadExtensionTools(extensionPath)
        toolDefinitions.push(...tools)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        warnings.push(`加载 Extension 失败 (${extensionPath}): ${message}`)
      }
    }
  }

  for (const warning of warnings) {
    console.warn(`[muse] ${warning}`)
  }

  return {
    tools: wrapToolDefinitionsForCwd(dedupeToolDefinitions(toolDefinitions), sessionCwd),
    warnings,
  }
}
