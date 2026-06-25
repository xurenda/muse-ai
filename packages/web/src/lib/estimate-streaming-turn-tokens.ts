import type { TurnTokenUsage } from '@museai/shared'
import type { AssistantContentBlock } from '@/lib/chat-types'

function estimateToolChars(tool: { toolName: string; args: unknown; result?: unknown }): number {
  let chars = tool.toolName.length
  try {
    chars += JSON.stringify(tool.args).length
  } catch {
    chars += String(tool.args).length
  }
  if (tool.result !== undefined) {
    try {
      chars += JSON.stringify(tool.result).length
    } catch {
      chars += String(tool.result).length
    }
  }
  return chars
}

/** 估算 assistant 消息 blocks 的字符总量（thinking / text / tool） */
export function estimateAssistantContentChars(blocks: AssistantContentBlock[]): number {
  let chars = 0
  for (const block of blocks) {
    if (block.type === 'thinking') {
      chars += block.thinking.length
    } else if (block.type === 'text') {
      chars += block.text.length
    } else if (block.type === 'tools') {
      for (const tool of block.tools) {
        chars += estimateToolChars(tool)
      }
    }
  }
  return chars
}

/** 保守估算 token 数（chars/4），对齐 pi compaction */
export function estimateTokensFromChars(chars: number): number {
  if (chars <= 0) return 0
  return Math.ceil(chars / 4)
}

/**
 * 计算 streaming 期间展示的 token 总量：
 * turn_end 已确认用量 + 当前未完成 turn 的内容估算（避免仅在 turn_end 时跳变）。
 */
export function computeStreamingTurnTokenDisplay(confirmedTotal: number, currentContentChars: number, contentCharsAtLastTurnEnd: number): number {
  const pendingChars = Math.max(0, currentContentChars - contentCharsAtLastTurnEnd)
  return confirmedTotal + estimateTokensFromChars(pendingChars)
}

/** 将 turn_end 已确认用量与当前 turn 估算合并为 TurnTokenUsage（仅 total 用于展示） */
export function mergeTurnUsageWithContentEstimate(
  confirmed: TurnTokenUsage | null | undefined,
  currentContentChars: number,
  contentCharsAtLastTurnEnd: number,
): TurnTokenUsage | undefined {
  const displayTotal = computeStreamingTurnTokenDisplay(confirmed?.total ?? 0, currentContentChars, contentCharsAtLastTurnEnd)
  if (displayTotal <= 0) return confirmed ?? undefined
  if (!confirmed) {
    return { input: 0, output: displayTotal, total: displayTotal }
  }
  if (displayTotal === confirmed.total) return confirmed
  return { ...confirmed, total: displayTotal }
}
