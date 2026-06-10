export interface ParsedToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ParsedAssistant {
  thinking: string
  text: string
  toolCalls: ParsedToolCall[]
  stopReason?: string
  timestamp?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function joinSections(...sections: string[]): string {
  return sections.filter((section) => section.trim().length > 0).join('\n')
}

function parseContentBlocks(content: unknown): Pick<ParsedAssistant, 'thinking' | 'text' | 'toolCalls'> {
  if (typeof content === 'string') {
    return { thinking: '', text: content, toolCalls: [] }
  }

  if (!Array.isArray(content)) {
    return { thinking: '', text: '', toolCalls: [] }
  }

  const thinkingParts: string[] = []
  const textParts: string[] = []
  const toolCalls: ParsedToolCall[] = []

  for (const part of content) {
    if (!isRecord(part) || typeof part.type !== 'string') {
      continue
    }

    if (part.type === 'thinking' && typeof part.thinking === 'string') {
      thinkingParts.push(part.thinking)
      continue
    }

    if (part.type === 'text' && typeof part.text === 'string') {
      textParts.push(part.text)
      continue
    }

    if (part.type === 'toolCall' && typeof part.name === 'string') {
      const id = readString(part.id) ?? `tool-${toolCalls.length}`
      const args = isRecord(part.arguments) ? part.arguments : {}
      toolCalls.push({ id, name: part.name, arguments: args })
    }
  }

  return {
    thinking: joinSections(...thinkingParts),
    text: joinSections(...textParts),
    toolCalls,
  }
}

/** 中间轮：含 toolCall 或 stopReason 为 toolUse */
export function isIntermediateAssistant(parsed: Pick<ParsedAssistant, 'toolCalls' | 'stopReason'>): boolean {
  return parsed.toolCalls.length > 0 || parsed.stopReason === 'toolUse'
}

/** 中间轮的过程说明 = thinking 块 + text 块 */
export function buildProcessContent(parsed: Pick<ParsedAssistant, 'thinking' | 'text'>): string {
  return joinSections(parsed.thinking, parsed.text)
}

export function parseAssistantMessage(message: unknown): ParsedAssistant | null {
  if (!isRecord(message) || message.role !== 'assistant') {
    return null
  }

  const blocks = parseContentBlocks(message.content)
  const stopReason = readString(message.stopReason)
  const timestamp = typeof message.timestamp === 'number' ? message.timestamp : undefined

  return {
    ...blocks,
    stopReason,
    timestamp,
  }
}

export function extractUserContent(message: unknown): string {
  if (!isRecord(message) || message.role !== 'user') {
    return ''
  }

  const { content } = message
  if (typeof content === 'string') {
    return content
  }

  return parseContentBlocks(content).text
}

export function parseToolResultMessage(message: unknown): {
  toolCallId: string
  toolName: string
  content: string
  isError: boolean
} | null {
  if (!isRecord(message) || message.role !== 'toolResult') {
    return null
  }

  const toolCallId = readString(message.toolCallId) ?? ''
  const toolName = readString(message.toolName) ?? 'tool'
  const content = parseContentBlocks(message.content).text
  const isError = message.isError === true

  if (!toolCallId && !content) {
    return null
  }

  return { toolCallId: toolCallId || `result-${toolName}`, toolName, content, isError }
}
