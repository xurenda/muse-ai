import { randomUUID } from 'node:crypto'
import { buildSessionContext } from '@earendil-works/pi-agent-core'
import type { AgentMessage, SessionTreeEntry } from '@earendil-works/pi-agent-core'
import type { SessionBranchMessage, SessionBranchToolCall, SessionTreeNode } from '@muse-ai/shared'
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

function extractThinkingContent(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .filter((part): part is { type: 'thinking'; thinking: string } => {
      return typeof part === 'object' && part !== null && 'type' in part && part.type === 'thinking' && 'thinking' in part
    })
    .map(part => part.thinking)
    .join('')
}

function extractAssistantToolCalls(content: unknown): SessionBranchToolCall[] {
  if (!Array.isArray(content)) return []
  return content
    .filter((part): part is { type: 'toolCall'; id: string; name: string; arguments: unknown } => {
      return typeof part === 'object' && part !== null && 'type' in part && part.type === 'toolCall' && 'id' in part && 'name' in part
    })
    .map(part => ({
      toolCallId: part.id,
      toolName: part.name,
      args: part.arguments,
    }))
}

function extractToolResultValue(message: Extract<AgentMessage, { role: 'toolResult' }>): unknown {
  if (message.details !== undefined) return message.details
  const text = extractTextContent(message.content)
  if (text.trim()) return text
  return message.content
}

function previewText(text: string, max = 120): string {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max)}…`
}

interface AssistantTurnAccum {
  id: string
  text: string
  thinking: string
  toolCalls: Map<string, SessionBranchToolCall>
  error?: string
  timestamp?: string
}

function createAssistantTurn(message: Extract<AgentMessage, { role: 'assistant' }>): AssistantTurnAccum {
  return {
    id: 'id' in message && typeof message.id === 'string' ? message.id : randomUUID(),
    text: messageText(message),
    thinking: extractThinkingContent(message.content),
    toolCalls: new Map(extractAssistantToolCalls(message.content).map(tool => [tool.toolCallId, tool])),
    error: extractBranchMessageError(message) ?? undefined,
    timestamp: messageTimestamp(message),
  }
}

function mergeAssistantTurn(turn: AssistantTurnAccum, message: Extract<AgentMessage, { role: 'assistant' }>): void {
  turn.id = 'id' in message && typeof message.id === 'string' ? message.id : turn.id
  turn.text += messageText(message)
  turn.thinking += extractThinkingContent(message.content)
  for (const tool of extractAssistantToolCalls(message.content)) {
    turn.toolCalls.set(tool.toolCallId, tool)
  }
  const error = extractBranchMessageError(message)
  if (error) turn.error = error
  turn.timestamp = messageTimestamp(message) ?? turn.timestamp
}

function messageTimestamp(message: AgentMessage): string | undefined {
  return 'timestamp' in message && typeof message.timestamp === 'number' ? new Date(message.timestamp).toISOString() : undefined
}

function flushAssistantTurn(turn: AssistantTurnAccum | null, result: SessionBranchMessage[]): void {
  if (!turn) return
  const toolCalls = [...turn.toolCalls.values()]
  const hasContent = turn.text.trim().length > 0 || turn.thinking.trim().length > 0 || toolCalls.length > 0 || turn.error !== undefined
  if (!hasContent) return
  result.push({
    id: turn.id,
    role: 'assistant',
    text: turn.text,
    thinking: turn.thinking.trim() ? turn.thinking : undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    error: turn.error,
    timestamp: turn.timestamp,
  })
}

/** Web Session 树面板仅展示可 navigate / fork 的节点 */
export function isSessionTreeNodeVisibleToWeb(node: SessionTreeNode): boolean {
  if (node.type === 'branch_summary') return true
  if (node.type === 'message') {
    return node.role === 'user' || node.role === 'assistant'
  }
  return false
}

/** 将 pi SessionTreeEntry 映射为 Web 可消费的精简节点（仅 message / branch_summary） */
export function mapSessionTreeEntry(entry: SessionTreeEntry): SessionTreeNode {
  switch (entry.type) {
    case 'message': {
      const role = entry.message.role
      if (role !== 'user' && role !== 'assistant') {
        throw new Error(`mapSessionTreeEntry 不支持 message.role=${role}`)
      }
      let preview = previewText(extractTextContent('content' in entry.message ? entry.message.content : ''))
      if (role === 'assistant') {
        const branchError = extractBranchMessageError(entry.message)
        if (branchError) {
          preview = previewText(branchError)
        } else if (!preview.trim()) {
          const thinking = extractThinkingContent('content' in entry.message ? entry.message.content : '')
          const tools = extractAssistantToolCalls('content' in entry.message ? entry.message.content : '')
          if (thinking.trim()) preview = previewText(thinking)
          else if (tools.length > 0) preview = previewText(tools.map(tool => tool.toolName).join(', '))
        }
      }
      return {
        id: entry.id,
        parentId: entry.parentId,
        timestamp: entry.timestamp,
        type: 'message',
        role,
        preview,
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
    default:
      throw new Error(`mapSessionTreeEntry 不支持 entry.type=${(entry as SessionTreeEntry).type}`)
  }
}

/** 映射并在不可展示时返回 null（内部节点不落 Web API） */
export function mapSessionTreeEntryForWeb(entry: SessionTreeEntry): SessionTreeNode | null {
  if (entry.type === 'leaf') return null
  if (entry.type === 'message' && entry.message.role === 'toolResult') return null
  if (
    entry.type === 'label' ||
    entry.type === 'model_change' ||
    entry.type === 'thinking_level_change' ||
    entry.type === 'compaction' ||
    entry.type === 'custom_message' ||
    entry.type === 'session_info' ||
    entry.type === 'active_tools_change' ||
    entry.type === 'custom'
  ) {
    return null
  }
  const node = mapSessionTreeEntry(entry)
  return isSessionTreeNodeVisibleToWeb(node) ? node : null
}

/** 配置类树节点，不应作为 chat 分支终点 */
function isInternalConfigEntry(entry: SessionTreeEntry): boolean {
  return entry.type === 'thinking_level_change' || entry.type === 'model_change' || entry.type === 'active_tools_change'
}

/** 取 session 中时间最新的 message 条目，作为对话主线 tip */
export async function findConversationTipEntryId(session: { getEntries(): Promise<SessionTreeEntry[]> }): Promise<string | null> {
  const entries = await session.getEntries()
  let tipId: string | null = null
  let tipTs = Number.NEGATIVE_INFINITY
  for (const entry of entries) {
    if (entry.type !== 'message') continue
    const ts = Date.parse(entry.timestamp)
    if (Number.isNaN(ts)) continue
    if (ts >= tipTs) {
      tipTs = ts
      tipId = entry.id
    }
  }
  return tipId
}

/**
 * 解析 chat 分支应使用的 leaf：
 * - 正常 navigate 到 user/assistant 时尊重 leaf
 * - leaf 落在配置节点（如 thinking_level_change）时回退到对话 tip，避免 chat 只显示首轮
 */
export async function resolveBranchLeafId(session: {
  getLeafId(): Promise<string | null>
  getEntry(id: string): Promise<SessionTreeEntry | undefined>
  getEntries(): Promise<SessionTreeEntry[]>
}): Promise<string | null> {
  const leafId = await session.getLeafId()
  if (!leafId) return findConversationTipEntryId(session)

  const entry = await session.getEntry(leafId)
  if (!entry || isInternalConfigEntry(entry)) {
    return findConversationTipEntryId(session)
  }
  return leafId
}

/** 仅保留 root → leaf 路径上的 entries（与 branch 一致，避免右栏展示无关分叉） */
export function filterEntriesToBranchPath(entries: SessionTreeEntry[], leafId: string | null): SessionTreeEntry[] {
  if (!leafId) {
    return entries.filter(entry => entry.parentId === null)
  }

  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const pathIds = new Set<string>()
  let current: SessionTreeEntry | undefined = byId.get(leafId)
  while (current) {
    pathIds.add(current.id)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return entries.filter(entry => pathIds.has(entry.id))
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

function messageText(message: AgentMessage): string {
  if (!('content' in message)) return ''
  return extractTextContent(message.content)
}

/** 从 pi buildContext 结果提取当前分支的可展示消息（按 user 轮次合并 assistant + toolResult） */
export function mapBranchMessages(messages: AgentMessage[]): SessionBranchMessage[] {
  const result: SessionBranchMessage[] = []
  let turn: AssistantTurnAccum | null = null

  for (const message of messages) {
    if (message.role === 'user') {
      flushAssistantTurn(turn, result)
      turn = null
      const text = messageText(message)
      if (!text.trim()) continue
      result.push({
        id: 'id' in message && typeof message.id === 'string' ? message.id : randomUUID(),
        role: 'user',
        text,
        timestamp: messageTimestamp(message),
      })
      continue
    }

    if (message.role === 'toolResult') {
      if (!turn) continue
      const existing = turn.toolCalls.get(message.toolCallId)
      if (!existing) continue
      turn.toolCalls.set(message.toolCallId, {
        ...existing,
        result: extractToolResultValue(message),
        isError: message.isError,
      })
      continue
    }

    if (message.role === 'assistant') {
      if (!turn) {
        turn = createAssistantTurn(message)
      } else {
        mergeAssistantTurn(turn, message)
      }
    }
  }

  flushAssistantTurn(turn, result)
  return result
}

/** 读取 session 当前 leaf 的分支消息 */
export async function buildBranchFromSession(
  session: {
    getBranch(fromId?: string): Promise<SessionTreeEntry[]>
    getLeafId(): Promise<string | null>
    getEntry(id: string): Promise<SessionTreeEntry | undefined>
    getEntries(): Promise<SessionTreeEntry[]>
  },
  leafId?: string | null,
): Promise<SessionBranchMessage[]> {
  const branchLeafId = leafId === undefined ? await resolveBranchLeafId(session) : leafId
  const branchEntries = branchLeafId ? await session.getBranch(branchLeafId) : await session.getBranch()
  const context = buildSessionContext(branchEntries)
  return mapBranchMessages(context.messages)
}
