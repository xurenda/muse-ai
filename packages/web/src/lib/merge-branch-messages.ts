import type { SessionBranchMessage } from '@muse-ai/shared'
import { finalizeRunningTools, hasRunningTool } from '@/lib/assistant-message-helpers'
import { branchMessagesToChat } from '@/lib/branch-messages'
import { isAssistantMessage, type AssistantChatMessage, type ChatMessage } from '@/lib/chat-types'

export interface MergeBranchOptions {
  /** CLI 重启或长时间不可达后，丢弃/收尾进行中的 SSE 尾部（避免 tool running 卡死） */
  finalizeStaleTail?: boolean
  interruptedToolMessage?: string
  interruptedTurnMessage?: string
}

function shouldPreserveAssistantTail(message: AssistantChatMessage): boolean {
  if (hasRunningTool(message)) return false
  if (message.streaming) return true
  return false
}

/** 断线后收尾未完成的 assistant（running tool / streaming） */
export function finalizeInterruptedAssistant(
  message: AssistantChatMessage,
  options?: Pick<MergeBranchOptions, 'interruptedToolMessage' | 'interruptedTurnMessage'>,
): AssistantChatMessage {
  const interruptedToolMessage = options?.interruptedToolMessage ?? 'Tool interrupted'
  const interruptedTurnMessage = options?.interruptedTurnMessage ?? 'Connection interrupted'

  const { blocks, hasRunningTool: hadRunningTool } = finalizeRunningTools(message.blocks, interruptedToolMessage)

  return {
    ...message,
    streaming: false,
    blocks,
    error: message.error ?? (hadRunningTool || message.streaming ? interruptedTurnMessage : undefined),
  }
}

function appendFinalizedTail(fromBranch: ChatMessage[], tail: AssistantChatMessage, options?: MergeBranchOptions): ChatMessage[] {
  const lastBranch = fromBranch.at(-1)
  if (lastBranch?.role === 'assistant') {
    return fromBranch
  }
  return [...fromBranch, finalizeInterruptedAssistant(tail, options)]
}

/** 刷新分支历史时保留 SSE 尚未写入 session 树的尾部 assistant（如 LLM 文本 delta） */
export function mergeBranchWithEphemeralTail(current: ChatMessage[], branch: SessionBranchMessage[], options?: MergeBranchOptions): ChatMessage[] {
  const fromBranch = branchMessagesToChat(branch)
  const lastCurrent = current.at(-1)

  if (options?.finalizeStaleTail) {
    if (lastCurrent && isAssistantMessage(lastCurrent) && (lastCurrent.streaming || hasRunningTool(lastCurrent))) {
      return appendFinalizedTail(fromBranch, lastCurrent, options)
    }
    return fromBranch
  }

  if (!lastCurrent || !isAssistantMessage(lastCurrent) || !shouldPreserveAssistantTail(lastCurrent)) {
    // 即使不保留 ephemeral tail，也把前端计算的 turnUsage/durationMs 合并到 branch 最后一条 assistant
    const lastBranchMsg = fromBranch.at(-1)
    if (lastBranchMsg?.role === 'assistant' && isAssistantMessage(lastCurrent ?? ({} as ChatMessage))) {
      // lastCurrent 是已完成的 assistant（streaming=false），且 branch 已有对应数据
      // 尝试从 current 补充 turnUsage/durationMs（branch 持久化可能还未落盘）
    }
    if (
      lastCurrent &&
      isAssistantMessage(lastCurrent) &&
      !lastCurrent.streaming &&
      lastBranchMsg?.role === 'assistant' &&
      (lastCurrent.turnUsage !== undefined || lastCurrent.durationMs !== undefined)
    ) {
      const patched = fromBranch.map((m, i) => {
        if (i !== fromBranch.length - 1 || m.role !== 'assistant') return m
        const am = m as AssistantChatMessage
        return {
          ...am,
          turnUsage: am.turnUsage ?? lastCurrent.turnUsage,
          durationMs: am.durationMs ?? lastCurrent.durationMs,
        }
      })
      return patched
    }
    return fromBranch
  }

  const lastBranch = fromBranch.at(-1)
  if (lastBranch?.role === 'assistant') {
    return fromBranch
  }

  return [...fromBranch, { ...lastCurrent, streaming: false }]
}
