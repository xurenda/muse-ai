/** 过程块状态：进行中 / 已完成 */
export type ProcessBlockStatus = 'active' | 'done'

/** UI 渲染单元 */
export type ChatViewItem = UserViewItem | ThinkingViewItem | ToolGroupViewItem | AnswerViewItem

export interface UserViewItem {
  kind: 'user'
  id: string
  content: string
}

export interface ThinkingViewItem {
  kind: 'thinking'
  id: string
  status: ProcessBlockStatus
  content: string
  startedAt: number
  endedAt?: number
  expanded: boolean
}

export interface ToolGroupToolEntry {
  kind: 'tool'
  toolCallId: string
  toolName: string
  input: string
  output: string
  isError?: boolean
  status: 'pending' | 'running' | 'done'
}

export interface ToolGroupThinkingEntry {
  kind: 'thinking'
  id: string
  status: ProcessBlockStatus
  content: string
  startedAt: number
  endedAt?: number
}

export type ToolGroupEntry = ToolGroupToolEntry | ToolGroupThinkingEntry

/** @deprecated 使用 ToolGroupToolEntry */
export type ToolViewItem = Omit<ToolGroupToolEntry, 'kind'>

export interface ToolGroupViewItem {
  kind: 'tool-group'
  id: string
  status: ProcessBlockStatus
  entries: ToolGroupEntry[]
  startedAt: number
  endedAt?: number
  expanded: boolean
}

export interface AnswerViewItem {
  kind: 'answer'
  id: string
  content: string
  streaming?: boolean
}

export interface ChatViewState {
  items: ChatViewItem[]
  /** 当前流式写入的顶层思考块 id */
  streamingThinkingId?: string
  /** 当前流式写入的探索组内思考 entry id */
  streamingNestedThinkingId?: string
  /** 当前流式写入的回答块 id */
  streamingAnswerId?: string
  /** 当前进行中的工具组 id */
  activeToolGroupId?: string
  /** 本轮是否已开始工具探索（用于判断是否将思考放入探索组） */
  explorationStarted: boolean
  nextId: number
}

export function createInitialChatViewState(): ChatViewState {
  return { items: [], explorationStarted: false, nextId: 0 }
}

export function countToolGroupTools(entries: ToolGroupEntry[]): number {
  return entries.filter((entry) => entry.kind === 'tool').length
}
