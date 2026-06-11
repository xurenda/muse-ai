import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import { Agent, type AgentEvent, type AgentMessage } from '@earendil-works/pi-agent-core'
import {
  DEFAULT_AGENT_ID,
  type CreateSessionRequest,
  type DaemonAgentEventMessage,
  type DaemonSessionErrorMessage,
  type DaemonSessionSnapshotMessage,
  type DaemonWsMessage,
  type SessionMeta,
} from '@muse-ai/shared'
import { createSessionAgent } from './agent-factory'
import type { MuseExtensionHost } from './extension-host'
import { isProviderAuthError, markProviderAuthFailure } from './provider-health'
import {
  appendSessionTranscriptEntries,
  deleteSessionFiles,
  readSessionMessages,
  scanSessionMetas,
  writeSessionMeta,
} from './session-store'

interface SessionRecord {
  meta: SessionMeta
  agent: Agent
  extensionHost: MuseExtensionHost
  clients: Set<WebSocket>
  unsubscribe?: () => void
  /** 已写入 jsonl 的消息条数 */
  persistedMessageCount: number
  /** 已受理 prompt、后台任务尚未结束（覆盖 isStreaming 生效前的窗口） */
  turnInProgress: boolean
}

function serializeAgentEvent(event: AgentEvent): Record<string, unknown> {
  return JSON.parse(JSON.stringify(event)) as Record<string, unknown>
}

function deriveSessionTitle(message: string): string {
  const normalized = message.replace(/\s+/g, ' ').trim()
  if (normalized.length <= 80) {
    return normalized
  }
  return `${normalized.slice(0, 79)}…`
}

function buildUserMessage(text: string): AgentMessage {
  return {
    role: 'user',
    content: [{ type: 'text', text }],
    timestamp: Date.now(),
  }
}

function isAbortedAssistantMessage(message: AgentMessage): boolean {
  return message.role === 'assistant' && message.stopReason === 'aborted'
}

export class SessionManager {
  private index = new Map<string, SessionMeta>()
  private sessions = new Map<string, SessionRecord>()

  /** daemon 启动时扫描磁盘，仅建立元数据索引 */
  async initialize(): Promise<void> {
    const metas = await scanSessionMetas()
    this.index.clear()
    for (const meta of metas) {
      this.index.set(meta.id, meta)
    }
  }

  async createSession(input: CreateSessionRequest): Promise<SessionMeta> {
    const agentId = input.agentId ?? DEFAULT_AGENT_ID
    const now = new Date().toISOString()
    const meta: SessionMeta = {
      id: randomUUID(),
      agentId,
      cwd: input.cwd,
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
    }

    const { agent, extensionHost } = await createSessionAgent({
      agentId,
      sessionId: meta.id,
      cwd: input.cwd,
    })
    const record = this.attachRuntime(meta, agent, extensionHost, 0)
    await extensionHost.emitSessionStart('startup')
    this.index.set(meta.id, meta)
    await writeSessionMeta(record.meta)
    return meta
  }

  hasSession(sessionId: string): boolean {
    return this.index.has(sessionId)
  }

  listSessions(agentId?: string): SessionMeta[] {
    const sessions = [...this.index.values()]
    const filtered = agentId ? sessions.filter((session) => session.agentId === agentId) : sessions
    return filtered.sort((left, right) => {
      const leftTime = Date.parse(left.updatedAt ?? left.createdAt)
      const rightTime = Date.parse(right.updatedAt ?? right.createdAt)
      return rightTime - leftTime
    })
  }

  async ensureHydrated(sessionId: string): Promise<SessionRecord> {
    const existing = this.sessions.get(sessionId)
    if (existing) {
      return existing
    }

    const meta = this.index.get(sessionId)
    if (!meta) {
      throw new Error('会话不存在')
    }

    const messages = await readSessionMessages(meta.agentId, meta.id)
    const { agent, extensionHost } = await createSessionAgent({
      agentId: meta.agentId,
      sessionId: meta.id,
      cwd: meta.cwd,
    })
    agent.state.messages = messages
    await extensionHost.emitSessionStart('resume')

    return this.attachRuntime(meta, agent, extensionHost, messages.length)
  }

  async getSessionResponse(sessionId: string) {
    const record = await this.ensureHydrated(sessionId)
    return {
      session: record.meta,
      messages: record.agent.state.messages,
      isStreaming: this.isSessionStreaming(record),
    }
  }

  async attachClient(sessionId: string, client: WebSocket): Promise<void> {
    const record = await this.ensureHydrated(sessionId)
    record.clients.add(client)
    this.sendWsMessage(client, this.buildSnapshotMessage(record))

    client.on('close', () => {
      record.clients.delete(client)
    })
  }

  /** 校验并受理 prompt，后台执行 agent 回合（fire-and-forget） */
  async acceptPrompt(sessionId: string, message: string): Promise<void> {
    const record = await this.ensureHydrated(sessionId)

    if (this.isSessionStreaming(record)) {
      throw new Error('Agent 正在回复中，请稍后再试')
    }

    const trimmed = message.trim()
    if (!record.meta.title) {
      record.meta.title = deriveSessionTitle(trimmed)
    }

    record.meta.updatedAt = new Date().toISOString()
    await writeSessionMeta(record.meta)
    this.index.set(sessionId, record.meta)

    record.turnInProgress = true
    this.broadcastSessionState(record)

    void this.executePrompt(sessionId, trimmed).finally(() => {
      const current = this.sessions.get(sessionId)
      if (!current) {
        return
      }
      current.turnInProgress = false
      this.broadcastSessionState(current)
    })
  }

  /** 中止当前 agent 回合 */
  async abortSession(sessionId: string): Promise<void> {
    const record = await this.ensureHydrated(sessionId)

    if (!this.isSessionStreaming(record)) {
      throw new Error('当前没有进行中的回复')
    }

    record.agent.abort()
  }

  /** 流式过程中注入 steering 消息（当前 turn 结束后优先处理） */
  async steerSession(sessionId: string, message: string): Promise<void> {
    const record = await this.ensureHydrated(sessionId)
    const trimmed = message.trim()

    if (!trimmed) {
      throw new Error('message 不能为空')
    }

    if (!record.agent.state.isStreaming) {
      throw new Error('Agent 尚未开始回复，请稍后再试')
    }

    record.agent.steer(buildUserMessage(trimmed))
  }

  /** 流式过程中排队 follow-up（整轮结束后才处理） */
  async followUpSession(sessionId: string, message: string): Promise<void> {
    const record = await this.ensureHydrated(sessionId)
    const trimmed = message.trim()

    if (!trimmed) {
      throw new Error('message 不能为空')
    }

    if (!this.isSessionStreaming(record)) {
      throw new Error('Agent 未在回复中，请直接发送消息')
    }

    record.agent.followUp(buildUserMessage(trimmed))
  }

  async deleteSession(sessionId: string): Promise<void> {
    const hydrated = this.sessions.get(sessionId)
    if (hydrated && this.isSessionStreaming(hydrated)) {
      throw new Error('Agent 正在回复中，无法删除会话')
    }

    const meta = this.index.get(sessionId) ?? hydrated?.meta
    if (!meta) {
      throw new Error('会话不存在')
    }

    if (hydrated) {
      hydrated.unsubscribe?.()
      await hydrated.extensionHost.emitSessionShutdown()
      for (const client of hydrated.clients) {
        client.close(1000, 'session deleted')
      }
      this.sessions.delete(sessionId)
    }

    this.index.delete(sessionId)
    await deleteSessionFiles(meta.agentId, meta.id)
  }

  private isSessionStreaming(record: SessionRecord): boolean {
    return record.turnInProgress || record.agent.state.isStreaming
  }

  private async executePrompt(sessionId: string, message: string): Promise<void> {
    const record = this.sessions.get(sessionId)
    if (!record) {
      return
    }

    try {
      await record.agent.prompt(message)
      await record.agent.waitForIdle()

      const messages = record.agent.state.messages as AgentMessage[]
      const lastMessage = messages[messages.length - 1]
      const wasAborted = lastMessage !== undefined && isAbortedAssistantMessage(lastMessage)

      if (record.agent.state.errorMessage && !wasAborted) {
        const errorMessage = record.agent.state.errorMessage
        const provider = record.agent.state.model?.provider
        if (typeof provider === 'string' && isProviderAuthError(errorMessage)) {
          markProviderAuthFailure(provider, errorMessage)
        }
        this.broadcastSessionError(sessionId, errorMessage)
      }

      await this.appendNewMessages(record)
      this.broadcastSnapshot(record)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.broadcastSessionError(sessionId, errorMessage)
    }
  }

  private attachRuntime(
    meta: SessionMeta,
    agent: Agent,
    extensionHost: MuseExtensionHost,
    persistedMessageCount: number,
  ): SessionRecord {
    const record: SessionRecord = {
      meta,
      agent,
      extensionHost,
      clients: new Set(),
      persistedMessageCount,
      turnInProgress: false,
    }

    record.unsubscribe = agent.subscribe((event) => {
      void extensionHost.handleAgentEvent(event).then(() => {
        this.broadcastEvent(meta.id, event)
      })
    })

    this.sessions.set(meta.id, record)
    return record
  }

  private buildSnapshotMessage(record: SessionRecord): DaemonSessionSnapshotMessage {
    return {
      type: 'session_snapshot',
      sessionId: record.meta.id,
      messages: record.agent.state.messages,
      isStreaming: this.isSessionStreaming(record),
    }
  }

  private sendWsMessage(client: WebSocket, message: DaemonWsMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message))
    }
  }

  private broadcastSessionState(record: SessionRecord): void {
    const payload: DaemonWsMessage = {
      type: 'session_state',
      sessionId: record.meta.id,
      isStreaming: this.isSessionStreaming(record),
    }
    const raw = JSON.stringify(payload)

    for (const client of record.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw)
      }
    }
  }

  /** 回合结束后向所有订阅者推送快照，便于多 tab 对齐 */
  private broadcastSnapshot(record: SessionRecord): void {
    const payload = this.buildSnapshotMessage(record)
    const raw = JSON.stringify(payload)

    for (const client of record.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw)
      }
    }
  }

  private broadcastSessionError(sessionId: string, error: string): void {
    const payload: DaemonSessionErrorMessage = {
      type: 'session_error',
      sessionId,
      error,
    }
    const raw = JSON.stringify(payload)

    const record = this.sessions.get(sessionId)
    if (!record) {
      return
    }

    for (const client of record.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw)
      }
    }
  }

  private broadcastEvent(sessionId: string, event: AgentEvent): void {
    const payload: DaemonAgentEventMessage = {
      type: 'agent_event',
      sessionId,
      event: serializeAgentEvent(event),
    }
    const raw = JSON.stringify(payload)

    const record = this.sessions.get(sessionId)
    if (!record) {
      return
    }

    for (const client of record.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw)
      }
    }
  }

  private async appendNewMessages(record: SessionRecord): Promise<void> {
    const messages = record.agent.state.messages as AgentMessage[]
    const newMessages = messages.slice(record.persistedMessageCount)

    if (newMessages.length > 0) {
      await appendSessionTranscriptEntries(record.meta.agentId, record.meta.id, newMessages)
      record.persistedMessageCount = messages.length
    }

    record.meta.messageCount = messages.length
    record.meta.updatedAt = new Date().toISOString()
    await writeSessionMeta(record.meta)
    this.index.set(record.meta.id, record.meta)
  }
}

export const sessionManager = new SessionManager()
