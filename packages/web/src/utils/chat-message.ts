import type { DaemonAgentEventMessage } from '@muse-ai/shared'

export type ChatMessageRole = 'user' | 'assistant' | 'tool'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  content: string
  streaming?: boolean
  toolName?: string
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .filter((part): part is { type: 'text'; text: string } => {
      return typeof part === 'object' && part !== null && 'type' in part && part.type === 'text'
    })
    .map((part) => part.text)
    .join('\n')
}

function extractTextFromAgentMessage(message: unknown): string {
  if (!message || typeof message !== 'object' || !('content' in message)) {
    return ''
  }

  return extractTextFromContent((message as { content?: unknown }).content)
}

function readToolName(message: unknown): string | undefined {
  if (!message || typeof message !== 'object' || !('toolName' in message)) {
    return undefined
  }
  const toolName = (message as { toolName?: unknown }).toolName
  return typeof toolName === 'string' ? toolName : undefined
}

function createChatMessageFromAgentMessage(message: unknown, index: number): ChatMessage | null {
  if (!message || typeof message !== 'object' || !('role' in message)) {
    return null
  }

  const role = (message as { role?: string }).role
  if (role === 'user' || role === 'assistant') {
    return {
      id: `${role}-${index}`,
      role,
      content: extractTextFromAgentMessage(message),
    }
  }

  if (role === 'toolResult') {
    const content = extractTextFromAgentMessage(message)
    if (!content) {
      return null
    }
    return {
      id: `tool-${index}`,
      role: 'tool',
      toolName: readToolName(message),
      content,
    }
  }

  return null
}

export function agentMessagesToChatMessages(messages: unknown[]): ChatMessage[] {
  const chatMessages: ChatMessage[] = []

  for (const [index, message] of messages.entries()) {
    const chatMessage = createChatMessageFromAgentMessage(message, index)
    if (chatMessage) {
      chatMessages.push(chatMessage)
    }
  }

  return chatMessages
}

export function applyAgentEvent(messages: ChatMessage[], payload: DaemonAgentEventMessage): ChatMessage[] {
  const event = payload.event

  if (event.type === 'message_start' && event.message && typeof event.message === 'object') {
    const message = event.message as { role?: string }
    if (message.role === 'toolResult') {
      const toolMessage = createChatMessageFromAgentMessage(event.message, messages.length)
      return toolMessage ? [...messages, toolMessage] : messages
    }
    if (message.role === 'assistant') {
      return [
        ...messages,
        {
          id: `assistant-${messages.length}`,
          role: 'assistant',
          content: extractTextFromAgentMessage(event.message),
          streaming: true,
        },
      ]
    }
  }

  if (event.type === 'message_update' && event.message && typeof event.message === 'object') {
    const next = [...messages]
    let lastIndex = -1
    for (let index = next.length - 1; index >= 0; index -= 1) {
      if (next[index]?.role === 'assistant' && next[index]?.streaming) {
        lastIndex = index
        break
      }
    }
    if (lastIndex >= 0) {
      next[lastIndex] = {
        ...next[lastIndex],
        content: extractTextFromAgentMessage(event.message),
        streaming: true,
      }
    }
    return next
  }

  if (event.type === 'message_end' && event.message && typeof event.message === 'object') {
    const message = event.message as { role?: string }
    if (message.role === 'toolResult') {
      const toolMessage = createChatMessageFromAgentMessage(event.message, messages.length)
      if (!toolMessage) {
        return messages
      }
      const existingIndex = messages.findIndex((item) => item.id === toolMessage.id)
      if (existingIndex >= 0) {
        const next = [...messages]
        next[existingIndex] = toolMessage
        return next
      }
      return [...messages, toolMessage]
    }

    const next = [...messages]
    let lastIndex = -1
    for (let index = next.length - 1; index >= 0; index -= 1) {
      if (next[index]?.role === 'assistant') {
        lastIndex = index
        break
      }
    }
    if (lastIndex >= 0) {
      next[lastIndex] = {
        ...next[lastIndex],
        content: extractTextFromAgentMessage(event.message),
        streaming: false,
      }
    }
    return next
  }

  return messages
}
