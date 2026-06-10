import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PLUGIN_MANIFEST_FILE_NAME, type PluginManifest } from '@muse-ai/shared'
import { isRecord } from './read-json-file'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function parsePluginManifest(value: unknown, manifestPath: string): PluginManifest {
  if (!isRecord(value)) {
    throw new Error(`${manifestPath} 格式无效：期望对象`)
  }

  const { id, name, description, version, extensions, skills, prompts, bins } = value

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error(`${manifestPath} 缺少有效的 id`)
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new Error(`${manifestPath} 缺少有效的 name`)
  }
  if (typeof version !== 'string' || version.trim().length === 0) {
    throw new Error(`${manifestPath} 缺少有效的 version`)
  }
  if (!isStringArray(extensions)) {
    throw new Error(`${manifestPath} 的 extensions 必须是字符串数组`)
  }
  if (!isStringArray(skills)) {
    throw new Error(`${manifestPath} 的 skills 必须是字符串数组`)
  }
  if (!isStringArray(prompts)) {
    throw new Error(`${manifestPath} 的 prompts 必须是字符串数组`)
  }
  if (!isStringArray(bins)) {
    throw new Error(`${manifestPath} 的 bins 必须是字符串数组`)
  }

  return {
    id: id.trim(),
    name: name.trim(),
    description: typeof description === 'string' ? description : undefined,
    version: version.trim(),
    extensions,
    skills,
    prompts,
    bins,
  }
}

export async function readPluginManifestFromDir(pluginRoot: string): Promise<PluginManifest> {
  const manifestPath = join(pluginRoot, PLUGIN_MANIFEST_FILE_NAME)
  const raw = await readFile(manifestPath, 'utf8')
  return parsePluginManifest(JSON.parse(raw) as unknown, manifestPath)
}
