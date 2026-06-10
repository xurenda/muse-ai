import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { join } from 'node:path'
import { PLUGIN_MANIFEST_FILE_NAME, type RegistryFile } from '@muse-ai/shared'
import { getMuseHomeDir, getPluginInstallPath, getRegistryPluginsPath } from '../data/paths'
import { readJsonFileIfExists } from './read-json-file'

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function hasPluginManifest(pluginRoot: string): Promise<boolean> {
  return pathExists(join(pluginRoot, PLUGIN_MANIFEST_FILE_NAME))
}

/** 根据 registry 或约定路径解析 Plugin 安装根目录 */
export async function resolvePluginRoot(pluginId: string): Promise<string | null> {
  const candidates: string[] = []
  const registry = await readJsonFileIfExists<RegistryFile>(getRegistryPluginsPath())
  const registryEntry = registry?.items.find((item) => item.id === pluginId)

  if (registryEntry) {
    candidates.push(join(getMuseHomeDir(), registryEntry.path))
  }
  candidates.push(getPluginInstallPath(pluginId))

  const seen = new Set<string>()
  for (const candidate of candidates) {
    if (seen.has(candidate)) {
      continue
    }
    seen.add(candidate)
    if (await hasPluginManifest(candidate)) {
      return candidate
    }
  }

  return null
}
