import type { SessionBranchBlock, SessionBranchToolCall } from '@museai/shared'
import type { AssistantChatMessage, AssistantContentBlock, ToolCallItem } from '@/lib/chat-types'

export function mapBranchToolToItem(tool: SessionBranchToolCall): ToolCallItem {
  return {
    toolCallId: tool.toolCallId,
    toolName: tool.toolName,
    args: tool.args,
    result: tool.result,
    isError: tool.isError,
    status: 'done',
  }
}

function mapBranchBlockToChatBlock(block: SessionBranchBlock): AssistantContentBlock {
  if (block.type === 'thinking') {
    return {
      type: 'thinking',
      thinking: block.thinking,
      durationMs: block.durationMs,
    }
  }
  if (block.type === 'text') {
    return { type: 'text', text: block.text }
  }
  return {
    type: 'tools',
    tools: block.tools.map(mapBranchToolToItem),
  }
}

/** 将 CLI branch blocks 映射为 ChatMessage blocks；兼容仅有扁平 thinking/text/toolCalls 的旧数据 */
export function branchBlocksToChatBlocks(
  blocks: SessionBranchBlock[] | undefined,
  fallbackThinking: string,
  fallbackText: string,
  fallbackTools: SessionBranchToolCall[] | undefined,
): AssistantContentBlock[] {
  if (blocks && blocks.length > 0) {
    const mapped = blocks.map(mapBranchBlockToChatBlock)
    const hasThinkingBlock = blocks.some(block => block.type === 'thinking')
    if (!hasThinkingBlock && fallbackThinking.trim()) {
      return [{ type: 'thinking', thinking: fallbackThinking }, ...mapped]
    }
    return mapped
  }

  const result: AssistantContentBlock[] = []
  if (fallbackThinking.trim()) {
    result.push({ type: 'thinking', thinking: fallbackThinking })
  }
  if (fallbackText.trim()) {
    result.push({ type: 'text', text: fallbackText })
  }
  if (fallbackTools && fallbackTools.length > 0) {
    result.push({ type: 'tools', tools: fallbackTools.map(mapBranchToolToItem) })
  }
  return result
}

export function getAssistantThinking(message: AssistantChatMessage): string {
  return message.blocks
    .filter((block): block is Extract<AssistantContentBlock, { type: 'thinking' }> => block.type === 'thinking')
    .map(block => block.thinking)
    .join('')
}

export function getAssistantText(message: AssistantChatMessage): string {
  return message.blocks
    .filter((block): block is Extract<AssistantContentBlock, { type: 'text' }> => block.type === 'text')
    .map(block => block.text)
    .join('')
}

export function getAssistantToolCalls(message: AssistantChatMessage): ToolCallItem[] {
  return message.blocks.flatMap(block => (block.type === 'tools' ? block.tools : []))
}

export function hasRunningTool(message: AssistantChatMessage): boolean {
  return getAssistantToolCalls(message).some(tool => tool.status === 'running')
}

export function hasAssistantAnswer(message: AssistantChatMessage): boolean {
  return getAssistantText(message).trim().length > 0
}

export function hasAssistantThinking(message: AssistantChatMessage): boolean {
  return getAssistantThinking(message).trim().length > 0
}

export function hasAssistantToolCalls(message: AssistantChatMessage): boolean {
  return getAssistantToolCalls(message).length > 0
}

export function appendThinkingDelta(blocks: AssistantContentBlock[], delta: string): AssistantContentBlock[] {
  if (!delta) return blocks
  const last = blocks.at(-1)
  if (last?.type === 'thinking') {
    const next = [...blocks]
    next[next.length - 1] = {
      type: 'thinking',
      thinking: last.thinking + delta,
      startedAt: last.startedAt,
      durationMs: last.durationMs,
    }
    return next
  }
  return [...blocks, { type: 'thinking', thinking: delta, startedAt: Date.now() }]
}

/** 结束当前未闭合的 thinking 块并写入耗时 */
export function finalizeOpenThinkingBlock(blocks: AssistantContentBlock[]): AssistantContentBlock[] {
  const last = blocks.at(-1)
  if (last?.type !== 'thinking' || last.durationMs !== undefined || last.startedAt === undefined) {
    return blocks
  }
  const next = [...blocks]
  next[next.length - 1] = {
    ...last,
    durationMs: Math.max(Date.now() - last.startedAt, 0),
    startedAt: undefined,
  }
  return next
}

/** 收尾消息内所有未闭合的 thinking 块（如 agent_end） */
export function finalizeOpenThinkingBlocks(blocks: AssistantContentBlock[]): AssistantContentBlock[] {
  const lastIndex = blocks.findLastIndex(block => block.type === 'thinking' && block.durationMs === undefined && block.startedAt !== undefined)
  if (lastIndex < 0) return blocks
  const next = [...blocks]
  const block = next[lastIndex]
  if (block?.type !== 'thinking' || block.startedAt === undefined) return blocks
  next[lastIndex] = {
    ...block,
    durationMs: Math.max(Date.now() - block.startedAt, 0),
    startedAt: undefined,
  }
  return next
}

export function appendTextDelta(blocks: AssistantContentBlock[], delta: string): AssistantContentBlock[] {
  if (!delta) return blocks
  const last = blocks.at(-1)
  if (last?.type === 'text') {
    const next = [...blocks]
    next[next.length - 1] = { type: 'text', text: last.text + delta }
    return next
  }
  return [...finalizeOpenThinkingBlock(blocks), { type: 'text', text: delta }]
}

export function appendToolStart(blocks: AssistantContentBlock[], tool: ToolCallItem): AssistantContentBlock[] {
  const base = finalizeOpenThinkingBlock(blocks)
  const last = base.at(-1)
  if (last?.type === 'tools') {
    const next = [...base]
    next[next.length - 1] = { type: 'tools', tools: [...last.tools, tool] }
    return next
  }
  return [...base, { type: 'tools', tools: [tool] }]
}

export function updateToolEnd(
  blocks: AssistantContentBlock[],
  toolCallId: string,
  update: Pick<ToolCallItem, 'result' | 'isError' | 'status'>,
): AssistantContentBlock[] {
  return blocks.map(block => {
    if (block.type !== 'tools') return block
    return {
      ...block,
      tools: block.tools.map(tool => (tool.toolCallId === toolCallId ? { ...tool, ...update } : tool)),
    }
  })
}

/** turn 结束或用户停止时收尾 assistant blocks（thinking + running tools） */
export function finalizeAssistantTurnBlocks(blocks: AssistantContentBlock[], stoppedToolMessage: string): AssistantContentBlock[] {
  const withThinking = finalizeOpenThinkingBlocks(blocks)
  return finalizeRunningTools(withThinking, stoppedToolMessage).blocks
}

export function finalizeRunningTools(
  blocks: AssistantContentBlock[],
  interruptedToolMessage: string,
): { blocks: AssistantContentBlock[]; hasRunningTool: boolean } {
  let hasRunning = false
  const next = blocks.map(block => {
    if (block.type !== 'tools') return block
    return {
      ...block,
      tools: block.tools.map(tool => {
        if (tool.status !== 'running') return tool
        hasRunning = true
        return { ...tool, status: 'done' as const, isError: true, result: interruptedToolMessage }
      }),
    }
  })
  return { blocks: next, hasRunningTool: hasRunning }
}
