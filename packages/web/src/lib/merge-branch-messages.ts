import type { SessionBranchMessage } from '@muse-ai/shared'
import { branchMessagesToChat } from '@/lib/branch-messages'
import { isAssistantMessage, type AssistantChatMessage, type ChatMessage } from '@/lib/chat-types'

function shouldPreserveAssistantTail(message: ChatMessage): message is AssistantChatMessage {
  if (!isAssistantMessage(message)) return false
  // error 已持久化在 session 分支，此处仅保留进行中的流式/tool 状态
  if (message.streaming) return true
  return message.toolCalls.some(tool => tool.status === 'running')
}

/** 刷新分支历史时保留 SSE 尚未写入 session 树的尾部 assistant（如 LLM 错误提示） */
export function mergeBranchWithEphemeralTail(current: ChatMessage[], branch: SessionBranchMessage[]): ChatMessage[] {
  const fromBranch = branchMessagesToChat(branch)
  const lastCurrent = current.at(-1)
  if (!lastCurrent || !shouldPreserveAssistantTail(lastCurrent)) {
    return fromBranch
  }

  const lastBranch = fromBranch.at(-1)
  if (lastBranch?.role === 'assistant') {
    return fromBranch
  }

  return [...fromBranch, { ...lastCurrent, streaming: false }]
}
