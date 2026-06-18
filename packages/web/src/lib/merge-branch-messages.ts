import type { SessionBranchMessage } from '@muse-ai/shared'
import { branchMessagesToChat } from '@/lib/branch-messages'
import { isAssistantMessage, type AssistantChatMessage, type ChatMessage } from '@/lib/chat-types'

export interface MergeBranchOptions {
  /** CLI 重启或长时间不可达后，丢弃/收尾进行中的 SSE 尾部（避免 tool running 卡死） */
  finalizeStaleTail?: boolean
  interruptedToolMessage?: string
  interruptedTurnMessage?: string
}

function shouldPreserveAssistantTail(message: AssistantChatMessage): boolean {
  if (message.toolCalls.some(tool => tool.status === 'running')) return false
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

  const hasRunningTool = message.toolCalls.some(tool => tool.status === 'running')
  const toolCalls = message.toolCalls.map(tool =>
    tool.status === 'running' ? { ...tool, status: 'done' as const, isError: true, result: interruptedToolMessage } : tool,
  )

  return {
    ...message,
    streaming: false,
    toolCalls,
    error: message.error ?? (hasRunningTool || message.streaming ? interruptedTurnMessage : undefined),
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
    if (lastCurrent && isAssistantMessage(lastCurrent) && (lastCurrent.streaming || lastCurrent.toolCalls.some(t => t.status === 'running'))) {
      return appendFinalizedTail(fromBranch, lastCurrent, options)
    }
    return fromBranch
  }

  if (!lastCurrent || !isAssistantMessage(lastCurrent) || !shouldPreserveAssistantTail(lastCurrent)) {
    return fromBranch
  }

  const lastBranch = fromBranch.at(-1)
  if (lastBranch?.role === 'assistant') {
    return fromBranch
  }

  return [...fromBranch, { ...lastCurrent, streaming: false }]
}
