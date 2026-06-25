import type { AgentHarnessEvent } from '@earendil-works/pi-agent-core'
import type { MuseSseEvent } from '@museai/shared'
import { extractTurnUsageFromMessage } from './session-token-usage.js'

/** 将 pi AgentHarnessEvent 映射为 Muse SSE 事件 */
export function mapHarnessEventToSse(event: AgentHarnessEvent): MuseSseEvent | null {
  switch (event.type) {
    case 'agent_start':
      return { type: 'agent_start' }
    case 'agent_end':
      return { type: 'agent_end' }
    case 'turn_start':
      return { type: 'turn_start' }
    case 'turn_end': {
      const usage = event.message.role === 'assistant' ? extractTurnUsageFromMessage(event.message) : undefined
      return usage ? { type: 'turn_end', usage } : { type: 'turn_end' }
    }
    case 'message_update': {
      const assistantEvent = event.assistantMessageEvent
      if (assistantEvent.type === 'text_delta') {
        return { type: 'text_delta', delta: assistantEvent.delta }
      }
      if (assistantEvent.type === 'thinking_delta') {
        return { type: 'thinking_delta', delta: assistantEvent.delta }
      }
      return null
    }
    case 'tool_execution_start':
      return {
        type: 'tool_start',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      }
    case 'tool_execution_end':
      return {
        type: 'tool_end',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
        isError: event.isError,
      }
    default:
      return null
  }
}
