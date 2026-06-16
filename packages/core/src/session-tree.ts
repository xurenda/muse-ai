import { randomUUID } from 'node:crypto'
import { buildSessionContext } from '@earendil-works/pi-agent-core'
import type { AgentMessage, SessionTreeEntry } from '@earendil-works/pi-agent-core'
import type { SessionBranchMessage, SessionTreeNode } from '@muse-ai/shared'
import { extractBranchMessageError } from './assistant-turn-error.js'

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((part): part is { type: 'text'; text: string } => {
      return typeof part === 'object' && part !== null && 'type' in part && part.type === 'text' && 'text' in part
    })
    .map(part => part.text)
    .join('')
}

function previewText(text: string, max = 120): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max)}…`
}

/** 将 pi SessionTreeEntry 映射为 Web 可消费的精简节点 */
export function mapSessionTreeEntry(entry: SessionTreeEntry): SessionTreeNode {
  switch (entry.type) {
    case 'message': {
      const role = entry.message.role
      let preview = previewText(extractTextContent('content' in entry.message ? entry.message.content : ''))
      if (role === 'assistant') {
        const branchError = extractBranchMessageError(entry.message)
        if (branchError) {
          preview = previewText(branchError)
        }
      }
      if (role === 'user' || role === 'assistant' || role === 'toolResult') {
        return {
          id: entry.id,
          parentId: entry.parentId,
          timestamp: entry.timestamp,
          type: 'message',
          role,
          preview,
        }
      }
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'custom_message',
        summary: preview || role,
      }
    }
    case 'branch_summary':
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'branch_summary',
        summary: previewText(entry.summary, 200),
        fromId: entry.fromId,
      }
    case 'label':
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'label',
        targetId: entry.targetId,
        label: entry.label,
      }
    case 'model_change':
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'model_change',
        provider: entry.provider,
        modelId: entry.modelId,
      }
    case 'thinking_level_change':
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'thinking_level_change',
        thinkingLevel: entry.thinkingLevel,
      }
    case 'compaction':
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'compaction',
        summary: previewText(entry.summary, 200),
      }
    case 'custom_message':
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'custom_message',
        summary: previewText(extractTextContent(entry.content)),
      }
    case 'session_info':
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'session_info',
        summary: entry.name?.trim() || undefined,
      }
    case 'active_tools_change':
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'active_tools_change',
        summary: entry.activeToolNames.join(', '),
      }
    case 'custom':
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'custom',
        summary: entry.customType,
      }
    case 'leaf':
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'leaf',
      }
  }
}

/** 计算 navigate 目标 leaf（与 pi AgentHarness.navigateTree 一致） */
export function resolveNavigateLeafId(entry: SessionTreeEntry): string | null {
  if (entry.type === 'message' && entry.message.role === 'user') {
    return entry.parentId
  }
  if (entry.type === 'custom_message') {
    return entry.parentId
  }
  return entry.id
}

function isDisplayBranchMessage(message: AgentMessage): message is Extract<AgentMessage, { role: 'user' | 'assistant' }> {
  return message.role === 'user' || message.role === 'assistant'
}

function messageText(message: AgentMessage): string {
  if (!('content' in message)) return ''
  return extractTextContent(message.content)
}

/** 从 pi buildContext 结果提取当前分支的可展示消息 */
export function mapBranchMessages(messages: AgentMessage[]): SessionBranchMessage[] {
  const result: SessionBranchMessage[] = []
  for (const message of messages) {
    if (!isDisplayBranchMessage(message)) continue
    const text = messageText(message)
    const error = message.role === 'assistant' ? extractBranchMessageError(message) : null
    if (message.role === 'user' && !text.trim()) continue
    if (message.role === 'assistant' && !text.trim() && !error) continue
    result.push({
      id: 'id' in message && typeof message.id === 'string' ? message.id : randomUUID(),
      role: message.role,
      text,
      error: error ?? undefined,
      timestamp: 'timestamp' in message && typeof message.timestamp === 'number' ? new Date(message.timestamp).toISOString() : undefined,
    })
  }
  return result
}

/** 读取 session 当前 leaf 的分支消息 */
export async function buildBranchFromSession(session: { getBranch(fromId?: string): Promise<SessionTreeEntry[]> }): Promise<SessionBranchMessage[]> {
  const branchEntries = await session.getBranch()
  const context = buildSessionContext(branchEntries)
  return mapBranchMessages(context.messages)
}
