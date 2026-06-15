import { randomUUID } from 'node:crypto'
import { JsonlSessionRepo, NodeExecutionEnv } from '@earendil-works/pi-agent-core/node'
import type { JsonlSessionMetadata } from '@earendil-works/pi-agent-core'
import type { CreateSessionRequest, SessionMeta } from '@muse-ai/shared'
import { loadSessionRegistry, saveSessionRegistry, type SessionRegistryEntry, toSessionMeta } from './session-registry.js'

export interface MuseSessionStoreOptions {
  /** JSONL 根目录，例如 ~/.muse/sessions */
  sessionsRoot: string
  /** Muse 元数据注册表路径，例如 ~/.muse/sessions/registry.json */
  registryPath: string
  /** Agent 工作目录，写入 pi Session header */
  cwd: string
}

/** 基于 pi JsonlSessionRepo 的本地 Session 存储，并用 registry 保存 agentId 等 Muse 元数据 */
export class MuseSessionStore {
  private readonly repo: JsonlSessionRepo
  private readonly registryPath: string
  private readonly cwd: string
  private registryLoaded = false
  private entries: SessionRegistryEntry[] = []

  constructor(options: MuseSessionStoreOptions) {
    const env = new NodeExecutionEnv({ cwd: options.cwd })
    this.repo = new JsonlSessionRepo({ fs: env, sessionsRoot: options.sessionsRoot })
    this.registryPath = options.registryPath
    this.cwd = options.cwd
  }

  private async ensureRegistry(): Promise<void> {
    if (this.registryLoaded) return
    const file = await loadSessionRegistry(this.registryPath)
    this.entries = file.entries
    this.registryLoaded = true
  }

  private async persistRegistry(): Promise<void> {
    await saveSessionRegistry(this.registryPath, {
      version: 1,
      entries: this.entries,
    })
  }

  private findEntry(id: string): SessionRegistryEntry | undefined {
    return this.entries.find(entry => entry.id === id)
  }

  private entryFromPiMetadata(metadata: JsonlSessionMetadata, agentId: string, name?: string): SessionRegistryEntry {
    const now = new Date().toISOString()
    return {
      id: metadata.id,
      agentId,
      name,
      createdAt: metadata.createdAt,
      updatedAt: now,
      cwd: metadata.cwd,
      jsonlPath: metadata.path,
    }
  }

  async create(request: CreateSessionRequest): Promise<SessionMeta> {
    await this.ensureRegistry()
    const id = randomUUID()
    const session = await this.repo.create({ cwd: this.cwd, id })
    const metadata = await session.getMetadata()
    const entry = this.entryFromPiMetadata(metadata, request.agentId, request.name)
    this.entries.push(entry)
    await this.persistRegistry()
    return toSessionMeta(entry)
  }

  async list(): Promise<SessionMeta[]> {
    await this.ensureRegistry()
    return [...this.entries].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map(toSessionMeta)
  }

  async get(id: string): Promise<SessionMeta | undefined> {
    await this.ensureRegistry()
    const entry = this.findEntry(id)
    return entry ? toSessionMeta(entry) : undefined
  }

  /** 对话或元数据变更时刷新 updatedAt */
  async touch(id: string): Promise<SessionMeta | undefined> {
    await this.ensureRegistry()
    const entry = this.findEntry(id)
    if (!entry) return undefined
    entry.updatedAt = new Date().toISOString()
    await this.persistRegistry()
    return toSessionMeta(entry)
  }

  /** 重启后校验 JSONL 是否仍可打开 */
  async openPiSession(id: string) {
    await this.ensureRegistry()
    const entry = this.findEntry(id)
    if (!entry) return undefined
    const metadata: JsonlSessionMetadata = {
      id: entry.id,
      createdAt: entry.createdAt,
      cwd: entry.cwd,
      path: entry.jsonlPath,
    }
    return this.repo.open(metadata)
  }
}
