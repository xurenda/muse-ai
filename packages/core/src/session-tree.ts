import { randomUUID } from 'node:crypto'
import { buildSessionContext } from '@earendil-works/pi-agent-core'
import type { AgentMessage, SessionTreeEntry } from '@earendil-works/pi-agent-core'
import type { SessionBranchBlock, SessionBranchMessage, SessionBranchToolCall, SessionTreeNode } from '@muse-ai/shared'
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

interface ToolCallLocation {
  blockIndex: number
  toolIndex: number
}

interface AssistantTurnAccum {
  id: string
  text: string
  blocks: SessionBranchBlock[]
  toolCalls: Map<string, SessionBranchToolCall>
  toolCallLocations: Map<string, ToolCallLocation>
  openThinkingBlockIndex: number | null
  openThinkingStartedAtMs: number | null
  lastMessageAtMs: number | null
  error?: string
  timestamp?: string
}

function messageTimestampMs(message: AgentMessage): number | undefined {
  return 'timestamp' in message && typeof message.timestamp === 'number' ? message.timestamp : undefined
}

function assistantMessageStartsWithThinking(message: Extract<AgentMessage, { role: 'assistant' }>): boolean {
  const { content } = message
  if (!Array.isArray(content)) return false
  for (const part of content) {
    if (typeof part !== 'object' || part === null || !('type' in part)) continue
    if (part.type === 'thinking') return true
    if (part.type === 'text' || part.type === 'toolCall') return false
  }
  return false
}

function finalizeOpenThinkingInTurn(turn: AssistantTurnAccum, endedAtMs: number | undefined): void {
  if (turn.openThinkingBlockIndex === null || turn.openThinkingStartedAtMs === null || endedAtMs === undefined) {
    turn.openThinkingBlockIndex = null
    turn.openThinkingStartedAtMs = null
    return
  }
  const block = turn.blocks[turn.openThinkingBlockIndex]
  if (block?.type !== 'thinking' || block.durationMs !== undefined) {
    turn.openThinkingBlockIndex = null
    turn.openThinkingStartedAtMs = null
    return
  }
  block.durationMs = Math.max(0, endedAtMs - turn.openThinkingStartedAtMs)
  turn.openThinkingBlockIndex = null
  turn.openThinkingStartedAtMs = null
}

function appendThinkingBlock(turn: AssistantTurnAccum, thinking: string, messageMs: number | undefined): void {
  if (!thinking) return
  const last = turn.blocks.at(-1)
  if (last?.type === 'thinking') {
    last.thinking += thinking
    return
  }
  turn.blocks.push({ type: 'thinking', thinking })
  turn.openThinkingBlockIndex = turn.blocks.length - 1
  turn.openThinkingStartedAtMs = messageMs ?? turn.lastMessageAtMs ?? null
}

function appendTextBlock(turn: AssistantTurnAccum, text: string, messageMs: number | undefined): void {
  if (!text) return
  finalizeOpenThinkingInTurn(turn, messageMs)
  turn.text += text
  const last = turn.blocks.at(-1)
  if (last?.type === 'text') {
    last.text += text
    return
  }
  turn.blocks.push({ type: 'text', text })
}

function appendToolCallBlock(turn: AssistantTurnAccum, tool: SessionBranchToolCall, messageMs: number | undefined): void {
  finalizeOpenThinkingInTurn(turn, messageMs)
  turn.toolCalls.set(tool.toolCallId, tool)
  const last = turn.blocks.at(-1)
  if (last?.type === 'tools') {
    const toolIndex = last.tools.length
    last.tools.push(tool)
    turn.toolCallLocations.set(tool.toolCallId, { blockIndex: turn.blocks.length - 1, toolIndex })
    return
  }
  turn.blocks.push({ type: 'tools', tools: [tool] })
  turn.toolCallLocations.set(tool.toolCallId, { blockIndex: turn.blocks.length - 1, toolIndex: 0 })
}

function appendAssistantContent(turn: AssistantTurnAccum, content: unknown, messageMs: number | undefined): void {
  if (!Array.isArray(content)) {
    if (typeof content === 'string' && content.trim()) {
      appendTextBlock(turn, content, messageMs)
    }
    return
  }

  for (const part of content) {
    if (typeof part !== 'object' || part === null || !('type' in part)) continue
    if (part.type === 'thinking' && 'thinking' in part && typeof part.thinking === 'string') {
      appendThinkingBlock(turn, part.thinking, messageMs)
      continue
    }
    if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
      appendTextBlock(turn, part.text, messageMs)
      continue
    }
    if (part.type === 'toolCall' && 'id' in part && 'name' in part && typeof part.id === 'string' && typeof part.name === 'string') {
      appendToolCallBlock(
        turn,
        {
          toolCallId: part.id,
          toolName: part.name,
          args: 'arguments' in part ? part.arguments : undefined,
        },
        messageMs,
      )
    }
  }
}

function touchTurnMessageTime(turn: AssistantTurnAccum, message: AgentMessage): void {
  const messageMs = messageTimestampMs(message)
  if (messageMs !== undefined) {
    turn.lastMessageAtMs = messageMs
  }
}

function createAssistantTurn(message: Extract<AgentMessage, { role: 'assistant' }>): AssistantTurnAccum {
  const turn: AssistantTurnAccum = {
    id: 'id' in message && typeof message.id === 'string' ? message.id : randomUUID(),
    text: '',
    blocks: [],
    toolCalls: new Map(),
    toolCallLocations: new Map(),
    openThinkingBlockIndex: null,
    openThinkingStartedAtMs: null,
    lastMessageAtMs: null,
    error: extractBranchMessageError(message) ?? undefined,
    timestamp: messageTimestamp(message),
  }
  touchTurnMessageTime(turn, message)
  appendAssistantContent(turn, message.content, messageTimestampMs(message))
  return turn
}

function mergeAssistantTurn(turn: AssistantTurnAccum, message: Extract<AgentMessage, { role: 'assistant' }>): void {
  const messageMs = messageTimestampMs(message)
  if (!assistantMessageStartsWithThinking(message)) {
    finalizeOpenThinkingInTurn(turn, messageMs)
  }
  turn.id = 'id' in message && typeof message.id === 'string' ? message.id : turn.id
  touchTurnMessageTime(turn, message)
  appendAssistantContent(turn, message.content, messageMs)
  const error = extractBranchMessageError(message)
  if (error) turn.error = error
  turn.timestamp = messageTimestamp(message) ?? turn.timestamp
}

function applyToolResultToTurn(turn: AssistantTurnAccum, toolCallId: string, result: unknown, isError?: boolean): void {
  const existing = turn.toolCalls.get(toolCallId)
  if (!existing) return
  const updated = { ...existing, result, isError }
  turn.toolCalls.set(toolCallId, updated)

  const location = turn.toolCallLocations.get(toolCallId)
  if (!location) return
  const block = turn.blocks[location.blockIndex]
  if (block?.type !== 'tools') return
  const tool = block.tools[location.toolIndex]
  if (!tool || tool.toolCallId !== toolCallId) return
  block.tools[location.toolIndex] = updated
}

function messageTimestamp(message: AgentMessage): string | undefined {
  return 'timestamp' in message && typeof message.timestamp === 'number' ? new Date(message.timestamp).toISOString() : undefined
}

function extractThinkingFromBlocks(blocks: SessionBranchBlock[]): string {
  return blocks
    .filter((block): block is Extract<SessionBranchBlock, { type: 'thinking' }> => block.type === 'thinking')
    .map(block => block.thinking)
    .join('')
}

function flushAssistantTurn(turn: AssistantTurnAccum | null, result: SessionBranchMessage[]): void {
  if (!turn) return
  finalizeOpenThinkingInTurn(turn, turn.lastMessageAtMs ?? undefined)
  const toolCalls = [...turn.toolCalls.values()]
  const thinking = extractThinkingFromBlocks(turn.blocks)
  const hasContent = turn.text.trim().length > 0 || thinking.trim().length > 0 || toolCalls.length > 0 || turn.error !== undefined
  if (!hasContent) return
  result.push({
    id: turn.id,
    role: 'assistant',
    text: turn.text,
    thinking: thinking.trim() ? thinking : undefined,
    blocks: turn.blocks.length > 0 ? turn.blocks : undefined,
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

function buildChildrenByParent(entries: SessionTreeEntry[]): Map<string | null, SessionTreeEntry[]> {
  const childrenByParent = new Map<string | null, SessionTreeEntry[]>()
  for (const entry of entries) {
    const siblings = childrenByParent.get(entry.parentId) ?? []
    siblings.push(entry)
    childrenByParent.set(entry.parentId, siblings)
  }
  return childrenByParent
}

function sortEntriesByTimestamp(entries: SessionTreeEntry[]): SessionTreeEntry[] {
  return [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

function isEntryOnPathToTarget(entries: SessionTreeEntry[], entryId: string, targetId: string | null): boolean {
  if (!targetId) return false
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  let current: SessionTreeEntry | undefined = byId.get(targetId)
  while (current) {
    if (current.id === entryId) return true
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return false
}

/** 向上查找 assistant / toolResult 等节点所属的 user 轮次起点 */
export function findTurnUserEntryId(entries: SessionTreeEntry[], entryId: string): string | null {
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  let current: SessionTreeEntry | undefined = byId.get(entryId)
  while (current) {
    if (current.type === 'message' && current.message.role === 'user') {
      return current.id
    }
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return null
}

function findLatestAssistantTimestampInTurnSubtree(childrenByParent: Map<string | null, SessionTreeEntry[]>, startId: string): number {
  let latest = Number.NEGATIVE_INFINITY

  function walk(nodeId: string): void {
    const children = childrenByParent.get(nodeId) ?? []
    for (const child of children) {
      if (child.type === 'message' && child.message.role === 'user') continue
      if (child.type === 'message' && child.message.role === 'assistant') {
        latest = Math.max(latest, Date.parse(child.timestamp))
      }
      walk(child.id)
    }
  }

  walk(startId)
  return latest
}

function isTurnWalkContinuationEntry(entry: SessionTreeEntry): boolean {
  if (entry.type === 'leaf' || entry.type === 'label' || entry.type === 'branch_summary') return false
  if (entry.type === 'message' && entry.message.role === 'user') return false
  return true
}

function pickTurnContinuationChild(children: SessionTreeEntry[], entries: SessionTreeEntry[], preferLeafId?: string | null): SessionTreeEntry | undefined {
  const continuations = children.filter(isTurnWalkContinuationEntry)
  if (continuations.length === 0) return undefined
  if (continuations.length === 1) return continuations[0]

  const childrenByParent = buildChildrenByParent(entries)
  if (preferLeafId) {
    const onPreferredPath = continuations.filter(child => isEntryOnPathToTarget(entries, child.id, preferLeafId))
    if (onPreferredPath.length === 1) return onPreferredPath[0]
    if (onPreferredPath.length > 1) {
      return onPreferredPath.reduce((best, candidate) => {
        const bestTs = findLatestAssistantTimestampInTurnSubtree(childrenByParent, best.id)
        const candidateTs = findLatestAssistantTimestampInTurnSubtree(childrenByParent, candidate.id)
        return candidateTs > bestTs ? candidate : best
      })
    }
  }

  return continuations.reduce((best, candidate) => {
    const bestTs = findLatestAssistantTimestampInTurnSubtree(childrenByParent, best.id)
    const candidateTs = findLatestAssistantTimestampInTurnSubtree(childrenByParent, candidate.id)
    return candidateTs > bestTs ? candidate : best
  })
}

/** 从 user 轮次起点向下 walk，定位 tool loop 完成后的最终 assistant 节点 */
export function findTurnTipEntryId(entries: SessionTreeEntry[], userEntryId: string, preferLeafId?: string | null): string {
  const childrenByParent = buildChildrenByParent(entries)
  let nodeId: string | null = userEntryId
  let lastAssistantId: string | null = null

  while (nodeId) {
    const children = sortEntriesByTimestamp(childrenByParent.get(nodeId) ?? [])
    if (children.length === 0) break

    const next = pickTurnContinuationChild(children, entries, preferLeafId)
    if (!next) break

    if (next.type === 'message' && next.message.role === 'assistant') {
      lastAssistantId = next.id
    }
    nodeId = next.id
  }

  return lastAssistantId ?? userEntryId
}

/**
 * 解析 Web navigate 的最终 leaf：
 * - user / custom_message 保持 pi 语义
 * - assistant 落到所属 user 轮次的最终 assistant，避免 chat 只显示 tool loop 中间态
 * @param preferLeafId 锚点 entry（通常为点击的 assistant），用于多分叉时选择正确延续路径
 */
export function resolveNavigateTargetLeafId(entry: SessionTreeEntry, entries: SessionTreeEntry[], preferLeafId?: string | null): string | null {
  const initial = resolveNavigateLeafId(entry)
  if (initial === null) return null
  if (entry.type !== 'message' || entry.message.role !== 'assistant') {
    return initial
  }

  const userEntryId = findTurnUserEntryId(entries, entry.id)
  if (!userEntryId) return initial
  return findTurnTipEntryId(entries, userEntryId, preferLeafId)
}

/** 从 leaf 向上收集路径上的 message 节点 id（含 toolResult 等非 Web 节点之间的 assistant/user） */
export function getMessagePathToLeaf(entries: SessionTreeEntry[], leafId: string | null): string[] {
  if (!leafId) return []
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const path: string[] = []
  let current: SessionTreeEntry | undefined = byId.get(leafId)
  while (current) {
    if (current.type === 'message' && (current.message.role === 'user' || current.message.role === 'assistant')) {
      path.unshift(current.id)
    }
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
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
      applyToolResultToTurn(turn, message.toolCallId, extractToolResultValue(message), message.isError)
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
