import type { ChatRequest, TurnTokenUsage } from '@museai/shared'

export type ChatInputMode = ChatRequest['mode']

export interface UserChatMessage {
  id: string
  role: 'user'
  content: string
  mode: ChatInputMode
  /** 消息完成时间（ISO 字符串） */
  timestamp?: string
}

export interface ToolCallItem {
  toolCallId: string
  toolName: string
  args: unknown
  result?: unknown
  isError?: boolean
  status: 'running' | 'done'
}

export type AssistantContentBlock =
  | { type: 'thinking'; thinking: string; /** 流式进行中起始时间 */ startedAt?: number; /** 完成后耗时 */ durationMs?: number }
  | { type: 'text'; text: string }
  | { type: 'tools'; tools: ToolCallItem[] }

export interface AssistantChatMessage {
  id: string
  role: 'assistant'
  blocks: AssistantContentBlock[]
  streaming: boolean
  error?: string
  /** 消息完成时间（ISO 字符串） */
  timestamp?: string
  /** 本次 agent 回复累计的真实 token 用量 */
  turnUsage?: TurnTokenUsage
  /** 本次 agent 回复总用时（ms） */
  durationMs?: number
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
    timestamp: new Date().toISOString(),
  }
}

export function createAssistantMessage(): AssistantChatMessage {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    blocks: [],
    streaming: true,
  }
}
