import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const MUSE_DIR_NAME = '.muse'
export const MUSE_CONFIG_VERSION = 1 as const

export interface MuseConfig {
  version: typeof MUSE_CONFIG_VERSION
  /** Backend 根 URL */
  backendUrl?: string
  /** 设备配对后写入 */
  deviceId?: string
  deviceToken?: string
  /** 新建 Session 的默认 Agent；`muse agent use` 写入 */
  activeAgentId?: string
}

export interface MusePaths {
  home: string
  config: string
  sessions: string
  agents: string
  personas: string
  skills: string
  mcps: string
  llmInspect: string
}

/** 本地 Muse 数据根目录；测试可通过 `MUSE_HOME` 覆盖 */
export function getMuseHomeDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.MUSE_HOME?.trim()
  if (override) return override
  return join(homedir(), MUSE_DIR_NAME)
}

export function getMusePaths(homeDir: string = getMuseHomeDir()): MusePaths {
  return {
    home: homeDir,
    config: join(homeDir, 'config.json'),
    sessions: join(homeDir, 'sessions'),
    agents: join(homeDir, 'agents'),
    personas: join(homeDir, 'personas'),
    skills: join(homeDir, 'skills'),
    mcps: join(homeDir, 'mcps'),
    llmInspect: join(homeDir, 'llm-inspect'),
  }
}

/** LLM 调试快照根目录：~/.muse/llm-inspect */
export function getLlmInspectDir(homeDir: string = getMuseHomeDir()): string {
  return join(homeDir, 'llm-inspect')
}

const DEFAULT_CONFIG: MuseConfig = {
  version: MUSE_CONFIG_VERSION,
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await readFile(path)
    return true
  } catch {
    return false
  }
}

/** 确保 ~/.muse 目录结构与默认 config.json 存在 */
export async function ensureMuseDir(paths: MusePaths = getMusePaths()): Promise<{ createdConfig: boolean }> {
  const hadConfig = await pathExists(paths.config)

  for (const dir of [paths.home, paths.sessions, paths.agents, paths.personas, paths.skills, paths.mcps]) {
    await mkdir(dir, { recursive: true })
  }

  let createdConfig = false
  if (!hadConfig) {
    await writeFile(paths.config, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, 'utf8')
    createdConfig = true
  }

  return { createdConfig }
}

export async function loadMuseConfig(paths: MusePaths = getMusePaths()): Promise<MuseConfig> {
  const raw = await readFile(paths.config, 'utf8')
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) {
    throw new Error(`无效的 Muse 配置: ${paths.config}`)
  }
  return parsed as MuseConfig
}

/** 合并写入 config.json（保留未传入字段） */
export async function saveMuseConfig(patch: Partial<MuseConfig>, paths: MusePaths = getMusePaths()): Promise<MuseConfig> {
  const current = (await pathExists(paths.config)) ? await loadMuseConfig(paths) : { ...DEFAULT_CONFIG }
  const next: MuseConfig = {
    ...current,
    ...patch,
    version: MUSE_CONFIG_VERSION,
  }
  await writeFile(paths.config, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  return next
}
