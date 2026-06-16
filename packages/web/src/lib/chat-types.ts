import type { ChatRequest } from '@muse-ai/shared'

export type ChatInputMode = ChatRequest['mode']

export interface UserChatMessage {
  id: string
  role: 'user'
  content: string
  mode: ChatInputMode
}

export interface ToolCallItem {
  toolCallId: string
  toolName: string
  args: unknown
  result?: unknown
  isError?: boolean
  status: 'running' | 'done'
}

export interface AssistantChatMessage {
  id: string
  role: 'assistant'
  text: string
  thinking: string
  toolCalls: ToolCallItem[]
  streaming: boolean
  error?: string
}

export type ChatMessage = UserChatMessage | AssistantChatMessage

export function isAssistantMessage(message: ChatMessage): message is AssistantChatMessage {
  return message.role === 'assistant'
}

export function createUserMessage(content: string, mode: ChatInputMode): UserChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    mode,
  }
}

export function createAssistantMessage(): AssistantChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    text: '',
    thinking: '',
    toolCalls: [],
    streaming: true,
  }
}
