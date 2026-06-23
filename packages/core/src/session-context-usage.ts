import type { AgentMessage, SessionTreeEntry } from '@earendil-works/pi-agent-core'
import { buildSessionContext } from '@earendil-works/pi-agent-core'
import type { AssistantMessage, Usage } from '@earendil-works/pi-ai'
import { type ContextUsage, computeCacheHitRate, computeContextUsagePercent } from '@muse-ai/shared'

const ESTIMATED_IMAGE_CHARS = 4800

interface ContextUsageEstimate {
  tokens: number
  usageTokens: number
  trailingTokens: number
  lastTurnCacheHitRate: number | null
}

function calculateContextTokens(usage: Usage): number {
  return usage.totalTokens || usage.input + usage.output + usage.cacheRead + usage.cacheWrite
}

function getAssistantUsage(message: AgentMessage): Usage | undefined {
  if (message.role !== 'assistant') return undefined
  const assistant = message as AssistantMessage
  if (assistant.stopReason === 'aborted' || assistant.stopReason === 'error' || !assistant.usage) {
    return undefined
  }
  return assistant.usage
}

function estimateTextAndImageContentChars(content: string | Array<{ type: string; text?: string }>): number {
  if (typeof content === 'string') return content.length

  let chars = 0
  for (const block of content) {
    if (block.type === 'text' && block.text) {
      chars += block.text.length
    } else if (block.type === 'image') {
      chars += ESTIMATED_IMAGE_CHARS
    }
  }
  return chars
}

/** 保守估算单条消息 token（chars/4），对齐 pi coding-agent compaction */
function estimateTokens(message: AgentMessage): number {
  let chars = 0

  switch (message.role) {
    case 'user':
      chars = estimateTextAndImageContentChars(message.content as string | Array<{ type: string; text?: string }>)
      return Math.ceil(chars / 4)
    case 'assistant': {
      const assistant = message as AssistantMessage
      for (const block of assistant.content) {
        if (block.type === 'text') chars += block.text.length
        else if (block.type === 'thinking') chars += block.thinking.length
        else if (block.type === 'toolCall') chars += block.name.length + JSON.stringify(block.arguments).length
      }
      return Math.ceil(chars / 4)
    }
    case 'custom':
    case 'toolResult':
      chars = estimateTextAndImageContentChars(message.content as string | Array<{ type: string; text?: string }>)
      return Math.ceil(chars / 4)
    default:
      return 0
  }
}

function getLastAssistantUsageInfo(messages: AgentMessage[]): { usage: Usage; index: number } | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!message) continue
    const usage = getAssistantUsage(message)
    if (usage) return { usage, index: i }
  }
  return undefined
}

/** 基于末轮 assistant usage + 后续消息估算，对齐 pi estimateContextTokens */
function estimateContextUsage(messages: AgentMessage[]): ContextUsageEstimate {
  const usageInfo = getLastAssistantUsageInfo(messages)

  if (!usageInfo) {
    let estimated = 0
    for (const message of messages) {
      if (!message) continue
      estimated += estimateTokens(message)
    }
    return {
      tokens: estimated,
      usageTokens: 0,
      trailingTokens: estimated,
      lastTurnCacheHitRate: null,
    }
  }

  const usageTokens = calculateContextTokens(usageInfo.usage)
  let trailingTokens = 0
  for (let i = usageInfo.index + 1; i < messages.length; i++) {
    const message = messages[i]
    if (!message) continue
    trailingTokens += estimateTokens(message)
  }

  const lastTurnCacheHitRate = computeCacheHitRate(usageInfo.usage.input, usageInfo.usage.cacheRead, usageInfo.usage.cacheWrite)

  return {
    tokens: usageTokens + trailingTokens,
    usageTokens,
    trailingTokens,
    lastTurnCacheHitRate,
  }
}

function getLatestCompactionIndex(entries: SessionTreeEntry[]): number {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i]
    if (entry?.type === 'compaction') return i
  }
  return -1
}

function hasPostCompactionAssistantUsage(entries: SessionTreeEntry[], compactionIndex: number): boolean {
  for (let i = entries.length - 1; i > compactionIndex; i--) {
    const entry = entries[i]
    if (!entry || entry.type !== 'message' || entry.message.role !== 'assistant') continue
    const assistant = entry.message as AssistantMessage
    if (assistant.stopReason === 'aborted' || assistant.stopReason === 'error') continue
    if (calculateContextTokens(assistant.usage) > 0) return true
    break
  }
  return false
}

function buildPendingContextUsage(contextWindow: number | null): ContextUsage {
  return {
    tokens: null,
    contextWindow,
    percent: null,
    usageTokens: null,
    trailingTokens: null,
    lastTurnCacheHitRate: null,
  }
}

/** 由分支 entries 计算 Context Usage，算法对齐 pi coding-agent AgentSession.getContextUsage */
export function computeContextUsageFromBranchEntries(branchEntries: SessionTreeEntry[], contextWindow: number | null): ContextUsage {
  const latestCompactionIndex = getLatestCompactionIndex(branchEntries)

  if (latestCompactionIndex >= 0 && !hasPostCompactionAssistantUsage(branchEntries, latestCompactionIndex)) {
    return buildPendingContextUsage(contextWindow)
  }

  const { messages } = buildSessionContext(branchEntries)
  const estimate = estimateContextUsage(messages)
  const percent = computeContextUsagePercent(estimate.tokens, contextWindow)

  return {
    tokens: estimate.tokens,
    contextWindow,
    percent,
    usageTokens: estimate.usageTokens,
    trailingTokens: estimate.trailingTokens,
    lastTurnCacheHitRate: estimate.lastTurnCacheHitRate,
  }
}

/** 从 pi Session 当前分支读取 Context Usage */
export async function readSessionContextUsage(session: { getBranch(): Promise<SessionTreeEntry[]> }, contextWindow: number | null): Promise<ContextUsage> {
  const branchEntries = await session.getBranch()
  return computeContextUsageFromBranchEntries(branchEntries, contextWindow)
}
