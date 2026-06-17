import type { AgentMessage, SessionTreeEntry } from '@earendil-works/pi-agent-core'
import type { SessionTokenUsage, TurnTokenUsage } from '@muse-ai/shared'
import { EMPTY_SESSION_TOKEN_USAGE } from '@muse-ai/shared'

interface PiUsageLike {
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
  total?: number
  totalTokens?: number
  cost?: { total?: number }
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
}

/** 将 pi Usage 规范化为 Muse TurnTokenUsage */
export function normalizeTurnTokenUsage(raw: PiUsageLike | undefined): TurnTokenUsage | undefined {
  if (!raw) return undefined

  const input = readNumber(raw.input)
  const output = readNumber(raw.output)
  const cacheRead = readNumber(raw.cacheRead)
  const cacheWrite = readNumber(raw.cacheWrite)
  const explicitTotal = readNumber(raw.total) || readNumber(raw.totalTokens)
  const total = explicitTotal > 0 ? explicitTotal : input + output + cacheRead + cacheWrite

  if (total <= 0 && input <= 0 && output <= 0 && cacheRead <= 0 && cacheWrite <= 0) {
    return undefined
  }

  const costTotal = raw.cost?.total
  return {
    input,
    output,
    cacheRead: cacheRead > 0 ? cacheRead : undefined,
    cacheWrite: cacheWrite > 0 ? cacheWrite : undefined,
    total,
    costTotal: typeof costTotal === 'number' && Number.isFinite(costTotal) && costTotal > 0 ? costTotal : undefined,
  }
}

/** 从 turn_end 的 assistant message 提取单轮用量 */
export function extractTurnUsageFromMessage(message: AgentMessage): TurnTokenUsage | undefined {
  if (message.role !== 'assistant') return undefined
  return normalizeTurnTokenUsage(message.usage)
}

/** 汇总 Session JSONL 中全部 assistant 消息的 token 用量 */
export function aggregateSessionTokenUsage(entries: SessionTreeEntry[]): SessionTokenUsage {
  let usage = { ...EMPTY_SESSION_TOKEN_USAGE }

  for (const entry of entries) {
    if (entry.type !== 'message' || entry.message.role !== 'assistant') continue
    const turn = extractTurnUsageFromMessage(entry.message)
    if (!turn) continue
    usage = {
      input: usage.input + turn.input,
      output: usage.output + turn.output,
      cacheRead: usage.cacheRead + (turn.cacheRead ?? 0),
      cacheWrite: usage.cacheWrite + (turn.cacheWrite ?? 0),
      total: usage.total + turn.total,
      costTotal: turn.costTotal === undefined && usage.costTotal === undefined ? undefined : (usage.costTotal ?? 0) + (turn.costTotal ?? 0),
      turnCount: usage.turnCount + 1,
    }
  }

  return usage
}

/** 从 pi Session 读取累计用量 */
export async function readSessionTokenUsage(session: { getEntries(): Promise<SessionTreeEntry[]> }): Promise<SessionTokenUsage> {
  const entries = await session.getEntries()
  return aggregateSessionTokenUsage(entries)
}
