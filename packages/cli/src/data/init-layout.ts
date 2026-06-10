import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { access } from 'node:fs/promises'
import {
  DEFAULT_AGENT_ID,
  type AgentRegistryFile,
  type RegistryFile,
} from '@muse-ai/shared'
import {
  DEFAULT_AGENT_CONFIG,
  DEFAULT_AGENT_SYSTEM,
  DEFAULT_AUTH,
  DEFAULT_MODELS,
  DEFAULT_SETTINGS,
  EMPTY_AGENT_REGISTRY,
  EMPTY_ENABLE_LIST,
  EMPTY_REGISTRY,
} from './defaults'
import {
  getAgentConfigPath,
  getAgentInstanceDir,
  getAgentPluginsPath,
  getAgentPromptsPath,
  getAgentSessionsDir,
  getAgentSkillsPath,
  getAgentSystemPath,
  getAgentsDir,
  getAuthPath,
  getModelsPath,
  getPluginsDir,
  getPromptsDir,
  getRegistryAgentsPath,
  getRegistryDir,
  getRegistryPluginsPath,
  getRegistryPromptsPath,
  getRegistrySkillsPath,
  getSessionsDir,
  getSettingsPath,
  getSkillsDir,
} from './paths'

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

async function writeJsonIfMissing(path: string, data: unknown): Promise<boolean> {
  if (await pathExists(path)) {
    return false
  }
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  return true
}

async function writeTextIfMissing(path: string, content: string): Promise<boolean> {
  if (await pathExists(path)) {
    return false
  }
  await writeFile(path, content, 'utf8')
  return true
}

async function initAuthFile(): Promise<void> {
  const created = await writeJsonIfMissing(getAuthPath(), DEFAULT_AUTH)
  if (created) {
    await chmod(getAuthPath(), 0o600)
  }
}

async function initRegistryFile(path: string, data: RegistryFile | AgentRegistryFile): Promise<void> {
  await writeJsonIfMissing(path, data)
}

async function initDefaultAgent(): Promise<void> {
  const agentId = DEFAULT_AGENT_ID
  await ensureDir(getAgentInstanceDir(agentId))
  await writeJsonIfMissing(getAgentConfigPath(agentId), DEFAULT_AGENT_CONFIG)
  await writeTextIfMissing(getAgentSystemPath(agentId), DEFAULT_AGENT_SYSTEM)
  await writeJsonIfMissing(getAgentPluginsPath(agentId), EMPTY_ENABLE_LIST)
  await writeJsonIfMissing(getAgentSkillsPath(agentId), EMPTY_ENABLE_LIST)
  await writeJsonIfMissing(getAgentPromptsPath(agentId), EMPTY_ENABLE_LIST)
}

/**
 * 初始化 ~/.muse/ 目录布局与默认文件。
 * 已存在的文件不会被覆盖。
 */
export async function ensureMuseDataLayout(): Promise<void> {
  await ensureDir(getRegistryDir())
  await ensureDir(getPluginsDir())
  await ensureDir(getSkillsDir())
  await ensureDir(getPromptsDir())
  await ensureDir(getAgentsDir())
  await ensureDir(getSessionsDir())
  await ensureDir(getAgentSessionsDir(DEFAULT_AGENT_ID))

  await writeJsonIfMissing(getSettingsPath(), DEFAULT_SETTINGS)
  await initAuthFile()
  await writeJsonIfMissing(getModelsPath(), DEFAULT_MODELS)

  await initRegistryFile(getRegistryPluginsPath(), EMPTY_REGISTRY)
  await initRegistryFile(getRegistrySkillsPath(), EMPTY_REGISTRY)
  await initRegistryFile(getRegistryPromptsPath(), EMPTY_REGISTRY)
  await initRegistryFile(getRegistryAgentsPath(), EMPTY_AGENT_REGISTRY)

  await initDefaultAgent()
}
