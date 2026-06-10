import { formatToolInput } from './format-tool-io'
import {
  buildProcessContent,
  extractUserContent,
  isIntermediateAssistant,
  parseAssistantMessage,
  parseToolResultMessage,
} from './parse-agent-message'
import type { ChatViewItem, ToolGroupEntry } from './types'

/** 从 agent transcript 离线重建视图（重连 / 历史） */
export function rebuildFromTranscript(messages: unknown[]): ChatViewItem[] {
  const items: ChatViewItem[] = []
  let explorationEntries: ToolGroupEntry[] = []
  let explorationStarted = false
  let toolGroupStartedAt = 0
  let toolGroupEndedAt = 0
  let pendingToolInputs = new Map<string, string>()
  let idCounter = 0

  const nextId = (prefix: string) => `${prefix}-${idCounter++}`

  const flushToolGroup = () => {
    if (explorationEntries.length === 0) {
      return
    }
    items.push({
      kind: 'tool-group',
      id: nextId('tool-group'),
      status: 'done',
      entries: explorationEntries,
      startedAt: toolGroupStartedAt,
      endedAt: toolGroupEndedAt,
      expanded: false,
    })
    explorationEntries = []
    explorationStarted = false
    pendingToolInputs = new Map()
  }

  const readTimestamp = (message: unknown, fallback: number): number => {
    if (typeof message === 'object' && message !== null && 'timestamp' in message) {
      const timestamp = (message as { timestamp?: unknown }).timestamp
      if (typeof timestamp === 'number') {
        return timestamp
      }
    }
    return fallback
  }

  for (const message of messages) {
    const userContent = extractUserContent(message)
    if (userContent) {
      flushToolGroup()
      items.push({
        kind: 'user',
        id: nextId('user'),
        content: userContent,
      })
      continue
    }

    const toolResult = parseToolResultMessage(message)
    if (toolResult) {
      const timestamp = readTimestamp(message, Date.now())
      if (!explorationStarted) {
        toolGroupStartedAt = timestamp
        explorationStarted = true
      }
      toolGroupEndedAt = timestamp
      explorationEntries.push({
        kind: 'tool',
        toolCallId: toolResult.toolCallId,
        toolName: toolResult.toolName,
        input: pendingToolInputs.get(toolResult.toolCallId) ?? '',
        output: toolResult.content,
        isError: toolResult.isError,
        status: 'done',
      })
      continue
    }

    const parsed = parseAssistantMessage(message)
    if (!parsed) {
      continue
    }

    if (isIntermediateAssistant(parsed)) {
      pendingToolInputs = new Map(
        parsed.toolCalls.map((toolCall) => [toolCall.id, formatToolInput(toolCall.arguments)]),
      )
      const processContent = buildProcessContent(parsed)
      if (processContent.trim()) {
        const timestamp = parsed.timestamp ?? Date.now()
        if (explorationStarted) {
          explorationEntries.push({
            kind: 'thinking',
            id: nextId('explore-thinking'),
            status: 'done',
            content: processContent,
            startedAt: timestamp,
            endedAt: timestamp,
          })
        } else {
          items.push({
            kind: 'thinking',
            id: nextId('thinking'),
            status: 'done',
            content: processContent,
            startedAt: timestamp,
            endedAt: timestamp,
            expanded: false,
          })
        }
      }
      continue
    }

    flushToolGroup()

    if (parsed.thinking.trim()) {
      const timestamp = parsed.timestamp ?? Date.now()
      items.push({
        kind: 'thinking',
        id: nextId('thinking'),
        status: 'done',
        content: parsed.thinking,
        startedAt: timestamp,
        endedAt: timestamp,
        expanded: false,
      })
    }

    if (parsed.text.trim()) {
      items.push({
        kind: 'answer',
        id: nextId('answer'),
        content: parsed.text,
      })
    }
  }

  flushToolGroup()
  return items
}

export function nextChatViewId(items: ChatViewItem[]): number {
  let max = 0
  for (const item of items) {
    const match = /^(\w+)-(\d+)$/.exec(item.id)
    if (match) {
      max = Math.max(max, Number.parseInt(match[2], 10) + 1)
    }
  }
  return max
}
