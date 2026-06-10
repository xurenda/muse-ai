import {
  PLUGINS_DIR_NAME,
  PLUGIN_MANIFEST_FILE_NAME,
  PROMPTS_DIR_NAME,
  SKILLS_DIR_NAME,
} from '../constants/paths'
import { namespaceIdToRelativePath } from './namespace-id'

function joinRelativePath(...segments: string[]): string {
  return segments
    .flatMap((segment) => segment.split('/'))
    .filter(Boolean)
    .join('/')
}

/** Plugin 在 ~/.muse/ 下的安装相对路径，如 plugins/muse/basic */
export function pluginInstallRelativePath(pluginId: string): string {
  return joinRelativePath(PLUGINS_DIR_NAME, namespaceIdToRelativePath(pluginId))
}

/** Plugin manifest.json 相对于 ~/.muse/ 的路径 */
export function pluginManifestRelativePath(pluginId: string): string {
  return joinRelativePath(pluginInstallRelativePath(pluginId), PLUGIN_MANIFEST_FILE_NAME)
}

/** 独立 Skill 在 ~/.muse/ 下的安装相对路径，如 skills/acme/review */
export function skillInstallRelativePath(skillId: string): string {
  return joinRelativePath(SKILLS_DIR_NAME, namespaceIdToRelativePath(skillId))
}

/** 独立 Prompt 在 ~/.muse/ 下的安装相对路径，如 prompts/local/my-prompt.md */
export function promptInstallRelativePath(promptId: string): string {
  return joinRelativePath(PROMPTS_DIR_NAME, `${namespaceIdToRelativePath(promptId)}.md`)
}

/**
 * 将 manifest 中的资源条目解析为相对于 ~/.muse/ 的路径。
 * 条目格式如 ./extensions/coding-tools.ts。
 */
export function resolvePluginManifestEntry(
  pluginInstallRelativePathValue: string,
  entry: string,
): string {
  const normalized = entry.trim().replace(/^\.\//, '')
  if (normalized.length === 0) {
    throw new Error('Plugin 资源路径不能为空')
  }
  if (normalized.startsWith('/') || normalized.includes('..')) {
    throw new Error(`无效的 Plugin 资源路径: ${entry}`)
  }
  return joinRelativePath(pluginInstallRelativePathValue, normalized)
}
