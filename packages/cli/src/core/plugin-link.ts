import { lstat, mkdir, readlink, symlink } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { DEFAULT_AGENT_ID } from '@muse-ai/shared'
import { ensureMuseDataLayout } from '../data/init-layout'
import { getPluginInstallPath } from '../data/paths'
import { readPluginManifestFromDir } from './plugin-manifest'
import { buildPluginRegistryEntry, enablePluginForAgent, upsertPluginRegistryEntry } from './plugin-registry'

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function ensureDirectorySymlink(sourcePath: string, targetPath: string): Promise<'created' | 'unchanged'> {
  const source = resolve(sourcePath)
  const target = resolve(targetPath)

  if (source === target) {
    throw new Error('不能将 Plugin 链接到自身')
  }

  await mkdir(dirname(target), { recursive: true })

  if (await pathExists(target)) {
    const stat = await lstat(target)
    if (stat.isSymbolicLink()) {
      const existingSource = resolve(dirname(target), await readlink(target))
      if (existingSource === source) {
        return 'unchanged'
      }
      throw new Error(`Plugin 已安装于 ${target}，且指向其他路径`)
    }
    throw new Error(`目标路径已存在且不是符号链接: ${target}`)
  }

  await symlink(source, target, 'dir')
  return 'created'
}

export interface LinkPluginResult {
  pluginId: string
  sourcePath: string
  installPath: string
  linkStatus: 'created' | 'unchanged'
  registryUpdated: boolean
  enabledForDefaultAgent: boolean
}

export async function linkPlugin(sourcePath: string): Promise<LinkPluginResult> {
  await ensureMuseDataLayout()

  const source = resolve(sourcePath)
  if (!(await pathExists(source))) {
    throw new Error(`Plugin 源目录不存在: ${source}`)
  }

  const manifest = await readPluginManifestFromDir(source)
  const installPath = getPluginInstallPath(manifest.id)
  const linkStatus = await ensureDirectorySymlink(source, installPath)

  await upsertPluginRegistryEntry(buildPluginRegistryEntry(manifest.id, manifest.version))
  const enabledForDefaultAgent = await enablePluginForAgent(manifest.id, DEFAULT_AGENT_ID)

  return {
    pluginId: manifest.id,
    sourcePath: source,
    installPath,
    linkStatus,
    registryUpdated: true,
    enabledForDefaultAgent,
  }
}
