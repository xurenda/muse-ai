import type { MuseSseEvent } from '@muse-ai/shared'
import {
  appendTextDelta,
  appendThinkingDelta,
  appendToolStart,
  finalizeAssistantTurnBlocks,
  finalizeOpenThinkingBlocks,
  updateToolEnd,
} from '@/lib/assistant-message-helpers'
import { type AssistantChatMessage, type ChatMessage, createAssistantMessage } from '@/lib/chat-types'

function updateLastAssistant(messages: ChatMessage[], updater: (message: AssistantChatMessage) => AssistantChatMessage): ChatMessage[] {
  const index = findLastAssistantIndex(messages)
  if (index < 0) {
    const created = updater(createAssistantMessage())
    return [...messages, created]
  }
  const next = [...messages]
  const current = messages[index]
  if (current?.role !== 'assistant') return messages
  next[index] = updater(current)
  return next
}

function findLastAssistantIndex(messages: ChatMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'assistant') return i
  }
  return -1
}

export interface ApplySseEventOptions {
  /** agent_end 时收尾仍 running 的 tool */
  stoppedToolMessage?: string
}

/** 用户停止或 turn 结束时收尾最后一条 assistant（streaming + running tools） */
export function finalizeStoppedAssistantTail(messages: ChatMessage[], stoppedToolMessage: string): ChatMessage[] {
  return updateLastAssistant(messages, m => ({
    ...m,
    streaming: false,
    blocks: finalizeAssistantTurnBlocks(m.blocks, stoppedToolMessage),
  }))
}

/** 将 SSE 事件累积到消息列表 */
export function applySseEvent(messages: ChatMessage[], event: MuseSseEvent, options?: ApplySseEventOptions): ChatMessage[] {
  switch (event.type) {
    case 'agent_start':
      return [...messages, createAssistantMessage()]

    case 'text_delta':
      return updateLastAssistant(messages, m => ({ ...m, blocks: appendTextDelta(m.blocks, event.delta) }))

    case 'thinking_delta':
      return updateLastAssistant(messages, m => ({ ...m, blocks: appendThinkingDelta(m.blocks, event.delta) }))

    case 'tool_start':
      return updateLastAssistant(messages, m => ({
        ...m,
        blocks: appendToolStart(m.blocks, {
          toolCallId: event.toolCallId,
          toolName: event.toolName,
          args: event.args,
          status: 'running',
        }),
      }))

    case 'tool_end':
      return updateLastAssistant(messages, m => ({
        ...m,
        blocks: updateToolEnd(m.blocks, event.toolCallId, {
          result: event.result,
          isError: event.isError,
          status: 'done',
        }),
      }))

    case 'agent_end':
      return updateLastAssistant(messages, m => ({
        ...m,
        streaming: false,
        blocks: options?.stoppedToolMessage ? finalizeAssistantTurnBlocks(m.blocks, options.stoppedToolMessage) : finalizeOpenThinkingBlocks(m.blocks),
      }))

    case 'error':
      return updateLastAssistant(messages, m => ({
        ...m,
        streaming: false,
        error: event.message,
      }))

    case 'turn_start':
    case 'turn_end':
    case 'session_meta_updated':
    default:
      return messages
  }
}

export function isStreaming(messages: ChatMessage[]): boolean {
  const last = messages.at(-1)
  return last?.role === 'assistant' && last.streaming
}
