import type { DaemonAgentEventMessage, DaemonWsMessage } from '@muse-ai/shared'
import {
  buildProcessContent,
  extractUserContent,
  isIntermediateAssistant,
  parseAssistantMessage,
  parseToolResultMessage,
} from './parse-agent-message'
import { formatToolInput, formatToolOutput } from './format-tool-io'
import { nextChatViewId, rebuildFromTranscript } from './rebuild-from-transcript'
import {
  appendToolEntryToGroup,
  createEmptyToolGroup,
  finalizeThinkingEntry,
  finalizeToolGroupItem,
  flushEmptyThinkingEntries,
  upsertThinkingEntryInGroup,
} from './tool-group-entries'
import type {
  AnswerViewItem,
  ChatViewItem,
  ChatViewState,
  ThinkingViewItem,
  ToolGroupViewItem,
} from './types'
import { createInitialChatViewState } from './types'

function allocateId(state: ChatViewState, prefix: string): { id: string; state: ChatViewState } {
  const id = `${prefix}-${state.nextId}`
  return { id, state: { ...state, nextId: state.nextId + 1 } }
}

function updateItem<T extends ChatViewItem>(
  items: ChatViewItem[],
  id: string,
  updater: (item: T) => T,
): ChatViewItem[] {
  return items.map((item) => (item.id === id ? updater(item as T) : item))
}

function finalizeTopLevelThinkingItem(item: ThinkingViewItem, endedAt: number): ThinkingViewItem {
  return {
    ...item,
    status: 'done',
    endedAt,
    expanded: false,
  }
}

function flushEmptyTopLevelThinking(items: ChatViewItem[]): ChatViewItem[] {
  return items.filter((item) => item.kind !== 'thinking' || item.content.trim().length > 0)
}

function updateActiveToolGroup(
  state: ChatViewState,
  groupId: string,
  updater: (group: ToolGroupViewItem) => ToolGroupViewItem,
): ChatViewState {
  return {
    ...state,
    items: updateItem<ToolGroupViewItem>(state.items, groupId, updater),
  }
}

function ensureActiveToolGroup(
  state: ChatViewState,
  startedAt: number,
): { state: ChatViewState; groupId: string } {
  if (state.activeToolGroupId) {
    return { state: { ...state, explorationStarted: true }, groupId: state.activeToolGroupId }
  }

  const { id, state: nextState } = allocateId(state, 'tool-group')
  const group = createEmptyToolGroup(id, startedAt)

  return {
    state: {
      ...nextState,
      items: [...nextState.items, group],
      activeToolGroupId: id,
      explorationStarted: true,
    },
    groupId: id,
  }
}

function finalizeActiveToolGroup(state: ChatViewState, now: number): ChatViewState {
  if (!state.activeToolGroupId) {
    return state
  }

  const groupId = state.activeToolGroupId
  return {
    ...state,
    items: updateItem<ToolGroupViewItem>(state.items, groupId, (group) =>
      finalizeToolGroupItem(
        {
          ...group,
          entries: flushEmptyThinkingEntries(group.entries),
        },
        now,
      ),
    ),
    activeToolGroupId: undefined,
    explorationStarted: false,
    streamingNestedThinkingId: undefined,
  }
}

function upsertNestedThinking(
  state: ChatViewState,
  groupId: string,
  content: string,
  options: { streaming: boolean; now: number; startedAt?: number },
): ChatViewState {
  let nextState = state
  let entryId = state.streamingNestedThinkingId

  if (!entryId) {
    const allocated = allocateId(state, 'explore-thinking')
    entryId = allocated.id
    nextState = allocated.state
  }

  nextState = updateActiveToolGroup(nextState, groupId, (group) =>
    upsertThinkingEntryInGroup(group, entryId, content, options),
  )

  return {
    ...nextState,
    streamingNestedThinkingId: options.streaming ? entryId : undefined,
  }
}

function upsertTopLevelThinking(
  state: ChatViewState,
  content: string,
  options: { streaming: boolean; now: number; startedAt?: number },
): ChatViewState {
  if (state.streamingThinkingId) {
    return {
      ...state,
      items: updateItem<ThinkingViewItem>(state.items, state.streamingThinkingId, (item) => ({
        ...item,
        content,
        status: options.streaming ? 'active' : 'done',
        endedAt: options.streaming ? item.endedAt : options.now,
        expanded: options.streaming,
      })),
      streamingThinkingId: options.streaming ? state.streamingThinkingId : undefined,
    }
  }

  if (!content.trim() && !options.streaming) {
    return state
  }

  const { id, state: nextState } = allocateId(state, 'thinking')
  const thinking: ThinkingViewItem = {
    kind: 'thinking',
    id,
    status: options.streaming ? 'active' : 'done',
    content,
    startedAt: options.startedAt ?? options.now,
    endedAt: options.streaming ? undefined : options.now,
    expanded: options.streaming,
  }

  return {
    ...nextState,
    items: [...nextState.items, thinking],
    streamingThinkingId: options.streaming ? id : undefined,
  }
}

function upsertAssistantItems(
  state: ChatViewState,
  parsed: NonNullable<ReturnType<typeof parseAssistantMessage>>,
  options: { streaming: boolean; now: number },
): ChatViewState {
  const intermediate = isIntermediateAssistant(parsed)

  if (intermediate) {
    const processContent = buildProcessContent(parsed)
    const nestInExplore = state.explorationStarted && state.activeToolGroupId

    if (nestInExplore && state.activeToolGroupId) {
      const groupId = state.activeToolGroupId
      if (!processContent.trim() && options.streaming) {
        return upsertNestedThinking(state, groupId, '', options)
      }
      if (!processContent.trim()) {
        return state
      }
      return upsertNestedThinking(state, groupId, processContent, {
        ...options,
        startedAt: parsed.timestamp,
      })
    }

    if (!processContent.trim() && options.streaming) {
      return upsertTopLevelThinking(state, '', options)
    }
    if (!processContent.trim()) {
      return state
    }
    return upsertTopLevelThinking(state, processContent, {
      ...options,
      startedAt: parsed.timestamp,
    })
  }

  let nextState = finalizeActiveToolGroup(state, options.now)

  if (parsed.thinking.trim()) {
    nextState = upsertTopLevelThinking(nextState, parsed.thinking, {
      ...options,
      startedAt: parsed.timestamp,
    })
  }

  if (nextState.streamingAnswerId) {
    return {
      ...nextState,
      items: updateItem<AnswerViewItem>(nextState.items, nextState.streamingAnswerId, (item) => ({
        ...item,
        content: parsed.text,
        streaming: options.streaming,
      })),
      streamingAnswerId: options.streaming ? nextState.streamingAnswerId : undefined,
    }
  }

  if (!parsed.text.trim() && !options.streaming) {
    return nextState
  }

  const { id, state: allocated } = allocateId(nextState, 'answer')
  const answer: AnswerViewItem = {
    kind: 'answer',
    id,
    content: parsed.text,
    streaming: options.streaming,
  }

  return {
    ...allocated,
    items: [...allocated.items, answer],
    streamingAnswerId: options.streaming ? id : undefined,
  }
}

function finalizeStreamingThinking(state: ChatViewState, now: number): ChatViewState {
  let nextState = state

  if (nextState.streamingThinkingId) {
    nextState = {
      ...nextState,
      items: updateItem<ThinkingViewItem>(
        nextState.items,
        nextState.streamingThinkingId,
        (item) => finalizeTopLevelThinkingItem(item, now),
      ),
      streamingThinkingId: undefined,
    }
  }

  if (nextState.streamingNestedThinkingId && nextState.activeToolGroupId) {
    const entryId = nextState.streamingNestedThinkingId
    const groupId = nextState.activeToolGroupId
    nextState = updateActiveToolGroup(nextState, groupId, (group) => ({
      ...group,
      entries: group.entries.map((entry) =>
        entry.kind === 'thinking' && entry.id === entryId ? finalizeThinkingEntry(entry, now) : entry,
      ),
    }))
    nextState = {
      ...nextState,
      streamingNestedThinkingId: undefined,
    }
  }

  return nextState
}

export function rebuildChatViewState(messages: unknown[]): ChatViewState {
  const items = rebuildFromTranscript(messages)
  return {
    ...createInitialChatViewState(),
    items,
    nextId: nextChatViewId(items),
  }
}

export function applyAgentEventToView(
  state: ChatViewState,
  event: Record<string, unknown>,
  now = Date.now(),
): ChatViewState {
  if (event.type === 'message_start' && event.message && typeof event.message === 'object') {
    const message = event.message as { role?: string }

    if (message.role === 'user') {
      const finalized = finalizeActiveToolGroup(state, now)
      const { id, state: nextState } = allocateId(finalized, 'user')
      return {
        ...nextState,
        items: [
          ...nextState.items,
          {
            kind: 'user',
            id,
            content: extractUserContent(event.message),
          },
        ],
        explorationStarted: false,
      }
    }

    if (message.role === 'assistant') {
      const parsed = parseAssistantMessage(event.message)
      if (!parsed) {
        return state
      }
      return upsertAssistantItems(state, parsed, { streaming: true, now })
    }
  }

  if (event.type === 'message_update' && event.message && typeof event.message === 'object') {
    const parsed = parseAssistantMessage(event.message)
    if (!parsed) {
      return state
    }
    return upsertAssistantItems(state, parsed, { streaming: true, now })
  }

  if (event.type === 'message_end' && event.message && typeof event.message === 'object') {
    const message = event.message as { role?: string }

    if (message.role === 'toolResult') {
      const toolResult = parseToolResultMessage(event.message)
      if (!toolResult) {
        return state
      }

      const ensured = ensureActiveToolGroup(state, now)
      return updateActiveToolGroup(ensured.state, ensured.groupId, (group) =>
        appendToolEntryToGroup(group, {
          toolCallId: toolResult.toolCallId,
          toolName: toolResult.toolName,
          input: '',
          output: toolResult.content,
          isError: toolResult.isError,
          status: 'done',
        }),
      )
    }

    if (message.role === 'assistant') {
      const parsed = parseAssistantMessage(event.message)
      if (!parsed) {
        return state
      }

      let nextState = upsertAssistantItems(state, parsed, { streaming: false, now })
      nextState = finalizeStreamingThinking(nextState, now)

      if (nextState.streamingAnswerId) {
        nextState = {
          ...nextState,
          items: updateItem<AnswerViewItem>(nextState.items, nextState.streamingAnswerId, (item) => ({
            ...item,
            streaming: false,
          })),
          streamingAnswerId: undefined,
        }
      }

      return { ...nextState, items: flushEmptyTopLevelThinking(nextState.items) }
    }
  }

  if (event.type === 'tool_execution_start') {
    const toolCallId = typeof event.toolCallId === 'string' ? event.toolCallId : `tool-${now}`
    const toolName = typeof event.toolName === 'string' ? event.toolName : 'tool'
    const ensured = ensureActiveToolGroup(state, now)
    return updateActiveToolGroup(ensured.state, ensured.groupId, (group) =>
      appendToolEntryToGroup(group, {
        toolCallId,
        toolName,
        input: formatToolInput(event.args),
        output: '',
        status: 'running',
      }),
    )
  }

  if (event.type === 'tool_execution_end') {
    const toolCallId = typeof event.toolCallId === 'string' ? event.toolCallId : undefined
    if (!toolCallId || !state.activeToolGroupId) {
      return state
    }

    return updateActiveToolGroup(state, state.activeToolGroupId, (group) =>
      appendToolEntryToGroup(group, {
        toolCallId,
        toolName: typeof event.toolName === 'string' ? event.toolName : 'tool',
        input: '',
        output: formatToolOutput(event.result),
        isError: event.isError === true,
        status: 'done',
      }),
    )
  }

  if (event.type === 'turn_end') {
    return state
  }

  if (event.type === 'agent_end') {
    let nextState = finalizeStreamingThinking(state, now)

    if (nextState.streamingAnswerId) {
      nextState = {
        ...nextState,
        items: updateItem<AnswerViewItem>(nextState.items, nextState.streamingAnswerId, (item) => ({
          ...item,
          streaming: false,
        })),
        streamingAnswerId: undefined,
      }
    }

    nextState = finalizeActiveToolGroup(nextState, now)
    return { ...nextState, items: flushEmptyTopLevelThinking(nextState.items) }
  }

  return state
}

export function applyAgentEventMessage(state: ChatViewState, payload: DaemonAgentEventMessage): ChatViewState {
  return applyAgentEventToView(state, payload.event)
}

export function isDaemonWsMessage(value: unknown): value is DaemonWsMessage {
  if (!value || typeof value !== 'object' || !('type' in value)) {
    return false
  }
  const type = (value as { type?: unknown }).type
  return (
    type === 'agent_event' ||
    type === 'session_snapshot' ||
    type === 'session_error' ||
    type === 'session_state'
  )
}

export function isAgentBusyEvent(event: Record<string, unknown>): boolean {
  return event.type === 'agent_start'
}

export function isAgentIdleEvent(event: Record<string, unknown>): boolean {
  return event.type === 'agent_end'
}
