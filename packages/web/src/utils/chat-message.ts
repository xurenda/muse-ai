import type { DaemonAgentEventMessage } from '@muse-ai/shared'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

function extractTextFromAgentMessage(message: unknown): string {
  if (!message || typeof message !== 'object' || !('content' in message)) {
    return ''
  }

  const content = (message as { content?: unknown }).content
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

export function applyAgentEvent(messages: ChatMessage[], payload: DaemonAgentEventMessage): ChatMessage[] {
  const event = payload.event
  if (event.type === 'message_start' && event.message && typeof event.message === 'object') {
    const message = event.message as { role?: string }
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
