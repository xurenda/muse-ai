import type { SessionBranchMessage } from '@muse-ai/shared'
import { createAssistantMessage, createUserMessage, type ChatMessage } from '@/lib/chat-types'

/** 将 CLI 分支历史映射为聊天消息列表 */
export function branchMessagesToChat(messages: SessionBranchMessage[]): ChatMessage[] {
  return messages.map(message => {
    if (message.role === 'user') {
      return createUserMessage(message.text, 'prompt')
    }
    const assistant = createAssistantMessage()
    return {
      ...assistant,
      id: message.id,
      text: message.text,
      thinking: message.thinking ?? '',
      toolCalls: (message.toolCalls ?? []).map(tool => ({
        toolCallId: tool.toolCallId,
        toolName: tool.toolName,
        args: tool.args,
        result: tool.result,
        isError: tool.isError,
        status: 'done' as const,
      })),
      error: message.error,
      streaming: false,
    }
  })
}
