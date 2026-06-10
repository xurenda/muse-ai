import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import { Agent, type AgentEvent, type AgentMessage } from '@earendil-works/pi-agent-core'
import {
  DEFAULT_AGENT_ID,
  type CreateSessionRequest,
  type DaemonAgentEventMessage,
  type SessionMeta,
} from '@muse-ai/shared'
import { getAgentSessionsDir } from '../data/paths'
import { createSessionAgent } from './agent-factory'
import { isProviderAuthError, markProviderAuthFailure } from './provider-health'

interface SessionRecord {
  meta: SessionMeta
  agent: Agent
  clients: Set<WebSocket>
  unsubscribe?: () => void
}

function serializeAgentEvent(event: AgentEvent): Record<string, unknown> {
  return JSON.parse(JSON.stringify(event)) as Record<string, unknown>
}

function getMessageText(message: AgentMessage): string {
  if (!('content' in message)) {
    return ''
  }

  const { content } = message
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .filter((part): part is { type: 'text'; text: string } => {
      return typeof part === 'object' && part !== null && 'type' in part && part.type === 'text'
    })
    .map((part) => part.text)
    .join('\n')
}

export class SessionManager {
  private sessions = new Map<string, SessionRecord>()

  async createSession(input: CreateSessionRequest): Promise<SessionMeta> {
    const agentId = input.agentId ?? DEFAULT_AGENT_ID
    const now = new Date().toISOString()
    const meta: SessionMeta = {
      id: randomUUID(),
      agentId,
      cwd: input.cwd,
      createdAt: now,
      updatedAt: now,
    }

    const agent = await createSessionAgent({ agentId, cwd: input.cwd })
    const record: SessionRecord = {
      meta,
      agent,
      clients: new Set(),
    }

    record.unsubscribe = agent.subscribe((event) => {
      this.broadcastEvent(meta.id, event)
    })

    this.sessions.set(meta.id, record)
    await this.persistSessionMeta(record)
    return meta
  }

  getSession(sessionId: string): SessionRecord | undefined {
    return this.sessions.get(sessionId)
  }

  getSessionResponse(sessionId: string) {
    const record = this.sessions.get(sessionId)
    if (!record) {
      return undefined
    }

    return {
      session: record.meta,
      messages: record.agent.state.messages,
      isStreaming: record.agent.state.isStreaming,
    }
  }

  attachClient(sessionId: string, client: WebSocket): void {
    const record = this.sessions.get(sessionId)
    if (!record) {
      client.close(4404, 'session not found')
      return
    }

    record.clients.add(client)
    client.on('close', () => {
      record.clients.delete(client)
    })
  }

  async prompt(sessionId: string, message: string): Promise<void> {
    const record = this.sessions.get(sessionId)
    if (!record) {
      throw new Error('会话不存在')
    }

    if (record.agent.state.isStreaming) {
      throw new Error('Agent 正在回复中，请稍后再试')
    }

    record.meta.updatedAt = new Date().toISOString()
    await this.persistSessionMeta(record)
    await record.agent.prompt(message.trim())
    await record.agent.waitForIdle()

    if (record.agent.state.errorMessage) {
      const provider = record.agent.state.model?.provider
      if (typeof provider === 'string' && isProviderAuthError(record.agent.state.errorMessage)) {
        markProviderAuthFailure(provider, record.agent.state.errorMessage)
      }
      throw new Error(record.agent.state.errorMessage)
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

  private async persistSessionMeta(record: SessionRecord): Promise<void> {
    const dir = getAgentSessionsDir(record.meta.agentId)
    await mkdir(dir, { recursive: true })
    const metaPath = join(dir, `${record.meta.id}.meta.json`)
    await writeFile(metaPath, `${JSON.stringify(record.meta, null, 2)}\n`, 'utf8')

    const transcriptPath = join(dir, `${record.meta.id}.jsonl`)
    const lines = record.agent.state.messages.map((message) =>
      JSON.stringify({
        role: message.role,
        text: getMessageText(message),
        message,
      }),
    )
    if (lines.length > 0) {
      await writeFile(transcriptPath, `${lines.join('\n')}\n`, 'utf8')
    }
  }
}

export const sessionManager = new SessionManager()
