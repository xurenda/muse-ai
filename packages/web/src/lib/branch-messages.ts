import type { SessionBranchMessage } from '@museai/shared'
import { branchBlocksToChatBlocks } from '@/lib/assistant-message-helpers'
import { createAssistantMessage, createUserMessage, type ChatMessage } from '@/lib/chat-types'

/** 将 CLI 分支历史映射为聊天消息列表 */
export function branchMessagesToChat(messages: SessionBranchMessage[]): ChatMessage[] {
  return messages.map(message => {
    if (message.role === 'user') {
      // 保留 CLI 侧的 message id，确保 retryFromMessage 等操作能稳定索引
      const userMsg = createUserMessage(message.text, 'prompt')
      return { ...userMsg, id: message.id, timestamp: message.timestamp }
    }
    const assistant = createAssistantMessage()
    return {
      ...assistant,
      id: message.id,
      blocks: branchBlocksToChatBlocks(message.blocks, message.thinking ?? '', message.text, message.toolCalls),
      error: message.error,
      streaming: false,
      timestamp: message.timestamp,
      turnUsage: message.turnUsage,
      durationMs: message.durationMs,
    }
  })
}
