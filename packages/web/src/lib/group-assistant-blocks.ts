import type { AssistantContentBlock, ToolCallItem } from '@/lib/chat-types'

export type ThinkingContentBlock = Extract<AssistantContentBlock, { type: 'thinking' }>
export type ProcessContentBlock = Extract<AssistantContentBlock, { type: 'thinking' | 'tools' }>

export type AssistantRenderSegment = { type: 'text'; text: string } | { type: 'process'; blocks: ProcessContentBlock[] }

/** 将连续的 thinking / tools 块合并为一段 process，text 块单独成段 */
export function groupAssistantBlocks(blocks: AssistantContentBlock[]): AssistantRenderSegment[] {
  const segments: AssistantRenderSegment[] = []
  let processBuffer: ProcessContentBlock[] = []

  const flushProcess = () => {
    if (processBuffer.length === 0) return
    segments.push({ type: 'process', blocks: processBuffer })
    processBuffer = []
  }

  for (const block of blocks) {
    if (block.type === 'text') {
      flushProcess()
      if (block.text.trim()) {
        segments.push({ type: 'text', text: block.text })
      }
      continue
    }
    processBuffer.push(block)
  }

  flushProcess()
  return segments
}

export function countProcessRun(blocks: ProcessContentBlock[]): { thinkingCount: number; toolCount: number } {
  let thinkingCount = 0
  let toolCount = 0
  for (const block of blocks) {
    if (block.type === 'thinking') {
      thinkingCount += 1
    }
    if (block.type === 'tools') {
      toolCount += block.tools.length
    }
  }
  return { thinkingCount, toolCount }
}

export type ProcessRunSummaryKey = 'both' | 'toolsOnly' | 'thinkingOnly'

/** 根据计数选择汇总 i18n key */
export function resolveProcessRunSummaryKey(thinkingCount: number, toolCount: number): ProcessRunSummaryKey | null {
  const hasThinking = thinkingCount > 0
  const hasTools = toolCount > 0
  if (hasThinking && hasTools) return 'both'
  if (hasTools) return 'toolsOnly'
  if (hasThinking) return 'thinkingOnly'
  return null
}

export type ProcessRunListItem = { kind: 'thinking'; thinking: string; durationMs?: number; startedAt?: number } | { kind: 'tool'; tool: ToolCallItem }

/** 按 blocks 顺序展开为 thinking / tool 列表项 */
export function flattenProcessRunItems(blocks: ProcessContentBlock[]): ProcessRunListItem[] {
  const items: ProcessRunListItem[] = []
  for (const block of blocks) {
    if (block.type === 'thinking') {
      items.push({
        kind: 'thinking',
        thinking: block.thinking,
        durationMs: block.durationMs,
        startedAt: block.startedAt,
      })
      continue
    }
    for (const tool of block.tools) {
      items.push({ kind: 'tool', tool })
    }
  }
  return items
}
