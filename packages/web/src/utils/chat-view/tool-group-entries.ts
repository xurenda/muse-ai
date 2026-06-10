import type { ProcessBlockStatus, ToolGroupEntry, ToolGroupThinkingEntry, ToolGroupToolEntry, ToolGroupViewItem } from './types'

export function appendToolEntryToGroup(group: ToolGroupViewItem, tool: Omit<ToolGroupToolEntry, 'kind'>): ToolGroupViewItem {
  const existingIndex = group.entries.findIndex(
    (entry) => entry.kind === 'tool' && entry.toolCallId === tool.toolCallId,
  )

  if (existingIndex >= 0) {
    const entries = [...group.entries]
    const previous = entries[existingIndex] as ToolGroupToolEntry
    entries[existingIndex] = {
      ...previous,
      ...tool,
      kind: 'tool',
      input: tool.input.trim() ? tool.input : previous.input,
      output: tool.output.trim() ? tool.output : previous.output,
    }
    return { ...group, entries }
  }

  return {
    ...group,
    entries: [...group.entries, { kind: 'tool', ...tool }],
  }
}

export function upsertThinkingEntryInGroup(
  group: ToolGroupViewItem,
  entryId: string,
  content: string,
  options: { streaming: boolean; now: number; startedAt?: number },
): ToolGroupViewItem {
  const existingIndex = group.entries.findIndex((entry) => entry.kind === 'thinking' && entry.id === entryId)

  if (existingIndex >= 0) {
    const entries = [...group.entries]
    const previous = entries[existingIndex] as ToolGroupThinkingEntry
    entries[existingIndex] = {
      ...previous,
      content,
      status: options.streaming ? 'active' : 'done',
      endedAt: options.streaming ? previous.endedAt : options.now,
    }
    return { ...group, entries }
  }

  const thinking: ToolGroupThinkingEntry = {
    kind: 'thinking',
    id: entryId,
    status: options.streaming ? 'active' : 'done',
    content,
    startedAt: options.startedAt ?? options.now,
    endedAt: options.streaming ? undefined : options.now,
  }

  return { ...group, entries: [...group.entries, thinking] }
}

export function finalizeThinkingEntry(entry: ToolGroupThinkingEntry, endedAt: number): ToolGroupThinkingEntry {
  return {
    ...entry,
    status: 'done',
    endedAt,
  }
}

export function finalizeToolGroupItem(item: ToolGroupViewItem, endedAt: number): ToolGroupViewItem {
  return {
    ...item,
    status: 'done',
    endedAt,
    expanded: false,
    entries: item.entries.map((entry) => {
      if (entry.kind === 'tool') {
        return { ...entry, status: 'done' as const }
      }
      return entry.status === 'active' ? finalizeThinkingEntry(entry, endedAt) : entry
    }),
  }
}

export function flushEmptyThinkingEntries(entries: ToolGroupEntry[]): ToolGroupEntry[] {
  return entries.filter((entry) => entry.kind !== 'thinking' || entry.content.trim().length > 0)
}

export function createEmptyToolGroup(id: string, startedAt: number): ToolGroupViewItem {
  return {
    kind: 'tool-group',
    id,
    status: 'active',
    entries: [],
    startedAt,
    expanded: true,
  }
}

export function isActiveProcessStatus(status: ProcessBlockStatus): boolean {
  return status === 'active'
}
