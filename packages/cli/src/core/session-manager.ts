import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import { Agent, type AgentEvent, type AgentMessage } from '@earendil-works/pi-agent-core'
import {
  DEFAULT_AGENT_ID,
  type CreateSessionRequest,
  type DaemonAgentEventMessage,
  type SessionMeta,
} from '@muse-ai/shared'
import { createSessionAgent } from './agent-factory'
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
  clients: Set<WebSocket>
  unsubscribe?: () => void
  /** 已写入 jsonl 的消息条数 */
  persistedMessageCount: number
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

    const agent = await createSessionAgent({ agentId, cwd: input.cwd })
    const record = this.attachRuntime(meta, agent, 0)
    this.index.set(meta.id, meta)
    await writeSessionMeta(record.meta)
    return meta
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
    const agent = await createSessionAgent({ agentId: meta.agentId, cwd: meta.cwd })
    agent.state.messages = messages

    return this.attachRuntime(meta, agent, messages.length)
  }

  async getSessionResponse(sessionId: string) {
    const record = await this.ensureHydrated(sessionId)
    return {
      session: record.meta,
      messages: record.agent.state.messages,
      isStreaming: record.agent.state.isStreaming,
    }
  }

  async attachClient(sessionId: string, client: WebSocket): Promise<void> {
    const record = await this.ensureHydrated(sessionId)
    record.clients.add(client)
    client.on('close', () => {
      record.clients.delete(client)
    })
  }

  async prompt(sessionId: string, message: string): Promise<void> {
    const record = await this.ensureHydrated(sessionId)

    if (record.agent.state.isStreaming) {
      throw new Error('Agent 正在回复中，请稍后再试')
    }

    const trimmed = message.trim()
    if (!record.meta.title) {
      record.meta.title = deriveSessionTitle(trimmed)
    }

    record.meta.updatedAt = new Date().toISOString()
    await writeSessionMeta(record.meta)
    this.index.set(sessionId, record.meta)

    await record.agent.prompt(trimmed)
    await record.agent.waitForIdle()

    if (record.agent.state.errorMessage) {
      const provider = record.agent.state.model?.provider
      if (typeof provider === 'string' && isProviderAuthError(record.agent.state.errorMessage)) {
        markProviderAuthFailure(provider, record.agent.state.errorMessage)
      }
      throw new Error(record.agent.state.errorMessage)
    }

    await this.appendNewMessages(record)
  }

  async deleteSession(sessionId: string): Promise<void> {
    const hydrated = this.sessions.get(sessionId)
    if (hydrated?.agent.state.isStreaming) {
      throw new Error('Agent 正在回复中，无法删除会话')
    }

    const meta = this.index.get(sessionId) ?? hydrated?.meta
    if (!meta) {
      throw new Error('会话不存在')
    }

    if (hydrated) {
      hydrated.unsubscribe?.()
      for (const client of hydrated.clients) {
        client.close(1000, 'session deleted')
      }
      this.sessions.delete(sessionId)
    }

    this.index.delete(sessionId)
    await deleteSessionFiles(meta.agentId, meta.id)
  }

  private attachRuntime(meta: SessionMeta, agent: Agent, persistedMessageCount: number): SessionRecord {
    const record: SessionRecord = {
      meta,
      agent,
      clients: new Set(),
      persistedMessageCount,
    }

    record.unsubscribe = agent.subscribe((event) => {
      this.broadcastEvent(meta.id, event)
    })

    this.sessions.set(meta.id, record)
    return record
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
