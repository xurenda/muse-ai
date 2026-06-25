import { randomUUID } from 'node:crypto'
import { JsonlSessionRepo, NodeExecutionEnv } from '@earendil-works/pi-agent-core/node'
import type { JsonlSessionMetadata } from '@earendil-works/pi-agent-core'
import type { SessionBranchMessage, SessionForkRequest, SessionMeta, SessionNameSource, SessionTreeNode } from '@museai/shared'
import type { ModelSelection } from '@museai/shared'
import { loadSessionRegistry, saveSessionRegistry, type SessionRegistryEntry, toSessionMeta } from './session-registry.js'
import { deriveSessionTitle } from './session-title.js'
import { buildBranchFromSession, getMessagePathToLeaf, mapSessionTreeEntryForWeb, resolveBranchLeafId, resolveNavigateTargetLeafId } from './session-tree.js'

export interface MuseSessionStoreOptions {
  /** JSONL 根目录，例如 ~/.muse/sessions */
  sessionsRoot: string
  /** Muse 元数据注册表路径，例如 ~/.muse/sessions/registry.json */
  registryPath: string
  /** Agent 工作目录，写入 pi Session header */
  cwd: string
}

export interface CreateSessionParams {
  agentId: string
  name?: string
  modelSelection?: ModelSelection
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

  private entryFromPiMetadata(
    metadata: JsonlSessionMetadata,
    agentId: string,
    options?: { name?: string; nameSource?: SessionNameSource },
  ): SessionRegistryEntry {
    const now = new Date().toISOString()
    return {
      id: metadata.id,
      agentId,
      name: options?.name,
      nameSource: options?.nameSource ?? (options?.name ? 'manual' : undefined),
      createdAt: metadata.createdAt,
      updatedAt: now,
      cwd: metadata.cwd,
      jsonlPath: metadata.path,
    }
  }

  async create(request: CreateSessionParams): Promise<SessionMeta> {
    await this.ensureRegistry()
    const id = randomUUID()
    const session = await this.repo.create({ cwd: this.cwd, id })
    const metadata = await session.getMetadata()
    const entry = this.entryFromPiMetadata(metadata, request.agentId, { name: request.name })
    if (request.modelSelection) {
      entry.modelSelection = request.modelSelection
    }
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

  /** 更新 Session 绑定的 Agent */
  async updateAgentId(id: string, agentId: string): Promise<SessionMeta | undefined> {
    await this.ensureRegistry()
    const entry = this.findEntry(id)
    if (!entry) return undefined
    entry.agentId = agentId
    entry.updatedAt = new Date().toISOString()
    await this.persistRegistry()
    return toSessionMeta(entry)
  }

  /** 更新 Session 级模型选择（tier 或具体 model）；切换时清除粘性解析结果 */
  async updateModelSelection(id: string, modelSelection: ModelSelection): Promise<SessionMeta | undefined> {
    await this.ensureRegistry()
    const entry = this.findEntry(id)
    if (!entry) return undefined
    entry.modelSelection = modelSelection
    delete entry.lastResolvedModelRef
    delete entry.lastResolvedContextWindow
    entry.updatedAt = new Date().toISOString()
    await this.persistRegistry()
    return toSessionMeta(entry)
  }

  /** 记录 Server 代理最近一次 chat 解析结果 */
  async updateLastResolvedModel(id: string, payload: { modelRef: string; contextWindow?: number }): Promise<SessionMeta | undefined> {
    await this.ensureRegistry()
    const entry = this.findEntry(id)
    if (!entry) return undefined
    entry.lastResolvedModelRef = payload.modelRef
    if (payload.contextWindow !== undefined && payload.contextWindow > 0) {
      entry.lastResolvedContextWindow = payload.contextWindow
    } else {
      delete entry.lastResolvedContextWindow
    }
    entry.updatedAt = new Date().toISOString()
    await this.persistRegistry()
    return toSessionMeta(entry)
  }

  /** 重命名 Session；manual 来源不会被自动标题覆盖 */
  async updateName(id: string, name: string, nameSource: SessionNameSource = 'manual'): Promise<SessionMeta | undefined> {
    await this.ensureRegistry()
    const entry = this.findEntry(id)
    if (!entry) return undefined
    entry.name = name.trim()
    entry.nameSource = nameSource
    entry.updatedAt = new Date().toISOString()
    await this.persistRegistry()
    return toSessionMeta(entry)
  }

  /** 首条用户消息时写入临时标题 */
  async setNameFromFirstMessageIfEmpty(id: string, message: string): Promise<SessionMeta | undefined> {
    await this.ensureRegistry()
    const entry = this.findEntry(id)
    if (!entry || entry.name?.trim() || entry.nameSource === 'manual') {
      return entry ? toSessionMeta(entry) : undefined
    }
    entry.name = deriveSessionTitle(message)
    entry.nameSource = 'first_message'
    entry.updatedAt = new Date().toISOString()
    await this.persistRegistry()
    return toSessionMeta(entry)
  }

  /** 删除 Session（registry + JSONL） */
  async delete(id: string): Promise<boolean> {
    await this.ensureRegistry()
    const entry = this.findEntry(id)
    if (!entry) return false
    await this.repo.delete(this.metadataFromRegistry(entry))
    this.entries = this.entries.filter(item => item.id !== id)
    await this.persistRegistry()
    return true
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

  private metadataFromRegistry(entry: SessionRegistryEntry): JsonlSessionMetadata {
    return {
      id: entry.id,
      createdAt: entry.createdAt,
      cwd: entry.cwd,
      path: entry.jsonlPath,
    }
  }

  /** 读取 session 树与当前分支消息 */
  async getTree(sessionId: string): Promise<{
    sessionId: string
    leafId: string | null
    activeMessagePathIds: string[]
    entries: SessionTreeNode[]
    branch: SessionBranchMessage[]
  }> {
    const piSession = await this.openPiSession(sessionId)
    if (!piSession) {
      throw new SessionStoreError('session_not_found', `Session 不存在: ${sessionId}`)
    }

    const rawEntries = await piSession.getEntries()
    const leafId = await piSession.getLeafId()
    const branchLeafId = await resolveBranchLeafId(piSession)
    const entries = rawEntries.map(entry => mapSessionTreeEntryForWeb(entry)).filter((node): node is SessionTreeNode => node !== null)

    return {
      sessionId,
      leafId,
      activeMessagePathIds: getMessagePathToLeaf(rawEntries, branchLeafId),
      entries,
      branch: await buildBranchFromSession(piSession, branchLeafId),
    }
  }

  /** 切换 active leaf（pi Session.moveTo） */
  async navigate(
    sessionId: string,
    entryId: string | null,
  ): Promise<{
    sessionId: string
    leafId: string | null
    activeMessagePathIds: string[]
    entries: SessionTreeNode[]
    branch: SessionBranchMessage[]
  }> {
    const piSession = await this.openPiSession(sessionId)
    if (!piSession) {
      throw new SessionStoreError('session_not_found', `Session 不存在: ${sessionId}`)
    }

    let targetLeafId: string | null = entryId
    if (entryId !== null) {
      const targetEntry = await piSession.getEntry(entryId)
      if (!targetEntry) {
        throw new SessionStoreError('entry_not_found', `树节点不存在: ${entryId}`)
      }
      const rawEntries = await piSession.getEntries()
      // 以点击的 entry 为锚点解析 turn tip，避免被当前 leaf 带到错误分叉
      targetLeafId = resolveNavigateTargetLeafId(targetEntry, rawEntries, entryId)
    }

    await piSession.moveTo(targetLeafId)
    await this.touch(sessionId)
    return this.getTree(sessionId)
  }

  /** 从指定节点 fork 出新 session（pi JsonlSessionRepo.fork） */
  async fork(sessionId: string, request: SessionForkRequest): Promise<SessionMeta> {
    await this.ensureRegistry()
    const entry = this.findEntry(sessionId)
    if (!entry) {
      throw new SessionStoreError('session_not_found', `Session 不存在: ${sessionId}`)
    }

    const sourceMetadata = this.metadataFromRegistry(entry)
    const forked = await this.repo.fork(sourceMetadata, {
      cwd: this.cwd,
      entryId: request.entryId,
      position: request.position,
      parentSessionPath: entry.jsonlPath,
    })
    const forkMetadata = await forked.getMetadata()
    const registryEntry = this.entryFromPiMetadata(forkMetadata, entry.agentId, { name: request.name })
    this.entries.push(registryEntry)
    await this.persistRegistry()
    return toSessionMeta(registryEntry)
  }
}

export class SessionStoreError extends Error {
  constructor(
    readonly code: 'session_not_found' | 'entry_not_found' | 'invalid_request',
    message: string,
  ) {
    super(message)
    this.name = 'SessionStoreError'
  }
}
