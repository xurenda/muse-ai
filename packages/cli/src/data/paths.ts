import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  AGENT_CONFIG_FILE_NAME,
  AGENT_PLUGINS_FILE_NAME,
  AGENT_PROMPTS_FILE_NAME,
  AGENT_SKILLS_FILE_NAME,
  AGENT_SYSTEM_FILE_NAME,
  AGENTS_DIR_NAME,
  AUTH_FILE_NAME,
  TRACE_DIR_NAME,
  EXTENSION_RUNTIME_DIR_NAME,
  DAEMON_STATE_FILE_NAME,
  DEFAULT_AGENT_ID,
  DEFAULT_DAEMON_PORT,
  MODELS_FILE_NAME,
  MUSE_DIR_NAME,
  MUSE_HOME_ENV,
  PLUGIN_MANIFEST_FILE_NAME,
  PLUGINS_DIR_NAME,
  pluginInstallRelativePath,
  PROMPTS_DIR_NAME,
  REGISTRY_AGENTS_FILE_NAME,
  REGISTRY_DIR_NAME,
  REGISTRY_PLUGINS_FILE_NAME,
  REGISTRY_PROMPTS_FILE_NAME,
  REGISTRY_SKILLS_FILE_NAME,
  SESSIONS_DIR_NAME,
  SETTINGS_FILE_NAME,
  SKILLS_DIR_NAME,
} from '@muse-ai/shared'

export function getMuseHomeDir(): string {
  const override = process.env[MUSE_HOME_ENV]
  if (override) {
    return override
  }
  return join(homedir(), MUSE_DIR_NAME)
}

export function getDaemonStatePath(): string {
  return join(getMuseHomeDir(), DAEMON_STATE_FILE_NAME)
}

export function getSettingsPath(): string {
  return join(getMuseHomeDir(), SETTINGS_FILE_NAME)
}

export function getAuthPath(): string {
  return join(getMuseHomeDir(), AUTH_FILE_NAME)
}

export function getModelsPath(): string {
  return join(getMuseHomeDir(), MODELS_FILE_NAME)
}

export function getRegistryDir(): string {
  return join(getMuseHomeDir(), REGISTRY_DIR_NAME)
}

export function getRegistryPluginsPath(): string {
  return join(getRegistryDir(), REGISTRY_PLUGINS_FILE_NAME)
}

export function getRegistrySkillsPath(): string {
  return join(getRegistryDir(), REGISTRY_SKILLS_FILE_NAME)
}

export function getRegistryPromptsPath(): string {
  return join(getRegistryDir(), REGISTRY_PROMPTS_FILE_NAME)
}

export function getRegistryAgentsPath(): string {
  return join(getRegistryDir(), REGISTRY_AGENTS_FILE_NAME)
}

export function getPluginsDir(): string {
  return join(getMuseHomeDir(), PLUGINS_DIR_NAME)
}

/** Plugin 安装目录绝对路径，如 ~/.muse/plugins/muse/basic */
export function getPluginInstallPath(pluginId: string): string {
  return join(getMuseHomeDir(), pluginInstallRelativePath(pluginId))
}

export function getPluginManifestPath(pluginId: string): string {
  return join(getPluginInstallPath(pluginId), PLUGIN_MANIFEST_FILE_NAME)
}

export function getSkillsDir(): string {
  return join(getMuseHomeDir(), SKILLS_DIR_NAME)
}

export function getPromptsDir(): string {
  return join(getMuseHomeDir(), PROMPTS_DIR_NAME)
}

export function getAgentsDir(): string {
  return join(getMuseHomeDir(), AGENTS_DIR_NAME)
}

export function getAgentInstanceDir(agentId: string): string {
  return join(getAgentsDir(), agentId)
}

export function getDefaultAgentInstanceDir(): string {
  return getAgentInstanceDir(DEFAULT_AGENT_ID)
}

export function getAgentConfigPath(agentId: string): string {
  return join(getAgentInstanceDir(agentId), AGENT_CONFIG_FILE_NAME)
}

export function getAgentSystemPath(agentId: string): string {
  return join(getAgentInstanceDir(agentId), AGENT_SYSTEM_FILE_NAME)
}

export function getAgentPluginsPath(agentId: string): string {
  return join(getAgentInstanceDir(agentId), AGENT_PLUGINS_FILE_NAME)
}

export function getAgentSkillsPath(agentId: string): string {
  return join(getAgentInstanceDir(agentId), AGENT_SKILLS_FILE_NAME)
}

export function getAgentPromptsPath(agentId: string): string {
  return join(getAgentInstanceDir(agentId), AGENT_PROMPTS_FILE_NAME)
}

export function getSessionsDir(): string {
  return join(getMuseHomeDir(), SESSIONS_DIR_NAME)
}

export function getTraceDir(): string {
  return join(getMuseHomeDir(), TRACE_DIR_NAME)
}

export function getExtensionRuntimeDir(sessionId: string): string {
  return join(getMuseHomeDir(), EXTENSION_RUNTIME_DIR_NAME, sessionId)
}

export function getAgentSessionsDir(agentId: string): string {
  return join(getSessionsDir(), agentId)
}

export function getDefaultAgentSessionsDir(): string {
  return getAgentSessionsDir(DEFAULT_AGENT_ID)
}

export function resolveDaemonPort(): number {
  const fromEnv = process.env.MUSE_DAEMON_PORT
  if (!fromEnv) {
    return DEFAULT_DAEMON_PORT
  }

  const parsed = Number.parseInt(fromEnv, 10)
  if (Number.isNaN(parsed)) {
    throw new Error(`无效的 MUSE_DAEMON_PORT: ${fromEnv}`)
  }

  return parsed
}
