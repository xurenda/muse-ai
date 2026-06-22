import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { SessionMeta, SessionNameSource } from '@muse-ai/shared'
import type { ModelSelection } from '@muse-ai/shared'

export const SESSION_REGISTRY_VERSION = 1 as const

export interface SessionRegistryEntry {
  id: string
  agentId: string
  name?: string
  nameSource?: SessionNameSource
  modelSelection?: ModelSelection
  /** Server 代理最近一次成功解析的 modelRef（chat task） */
  lastResolvedModelRef?: string
  createdAt: string
  updatedAt: string
  cwd: string
  jsonlPath: string
}

export interface SessionRegistryFile {
  version: typeof SESSION_REGISTRY_VERSION
  entries: SessionRegistryEntry[]
}

export function toSessionMeta(entry: SessionRegistryEntry): SessionMeta {
  return {
    id: entry.id,
    agentId: entry.agentId,
    name: entry.name,
    nameSource: entry.nameSource,
    modelSelection: entry.modelSelection,
    lastResolvedModelRef: entry.lastResolvedModelRef,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }
}

export async function loadSessionRegistry(registryPath: string): Promise<SessionRegistryFile> {
  try {
    const raw = await readFile(registryPath, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      !('entries' in parsed) ||
      !Array.isArray((parsed as SessionRegistryFile).entries)
    ) {
      throw new Error('invalid shape')
    }
    return parsed as SessionRegistryFile
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: SESSION_REGISTRY_VERSION, entries: [] }
    }
    if (error instanceof Error && error.message === 'invalid shape') {
      throw new Error(`无效的 Session 注册表: ${registryPath}`)
    }
    throw error
  }
}

export async function saveSessionRegistry(registryPath: string, file: SessionRegistryFile): Promise<void> {
  await mkdir(dirname(registryPath), { recursive: true })
  await writeFile(registryPath, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
}
