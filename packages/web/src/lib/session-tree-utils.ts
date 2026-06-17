import type { Edge, Node } from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import type { SessionTreeNode } from '@muse-ai/shared'

export interface SessionTreeItem {
  node: SessionTreeNode
  children: SessionTreeItem[]
  depth: number
}

/** 合并 user + assistant 后的对话轮次节点 */
export interface SessionTurn {
  id: string
  /** navigate / fork 使用的 entry id */
  entryId: string
  userPreview?: string
  assistantPreview?: string
  branchSummary?: string
  entryIds: string[]
  timestamp: string
  parentTurnId: string | null
  children: SessionTurn[]
}

export interface SessionTurnFlowNodeData extends Record<string, unknown> {
  turn: SessionTurn
  active: boolean
  disabled: boolean
  onNavigate: (entryId: string) => void
  onFork: (entryId: string) => void
}

export const SESSION_TURN_NODE_TYPE = 'sessionTurn'
export const SESSION_TURN_NODE_WIDTH = 220
export const SESSION_TURN_NODE_HEIGHT = 88

/** 将扁平 entries 按 parentId 组装为树（多根取 parentId=null） */
export function buildSessionTreeItems(entries: SessionTreeNode[]): SessionTreeItem[] {
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const childrenMap = new Map<string | null, SessionTreeNode[]>()

  for (const entry of entries) {
    const parentId = entry.parentId && byId.has(entry.parentId) ? entry.parentId : null
    const siblings = childrenMap.get(parentId) ?? []
    siblings.push(entry)
    childrenMap.set(parentId, siblings)
  }

  const sortByTime = (items: SessionTreeNode[]) => [...items].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  function walk(parentId: string | null, depth: number): SessionTreeItem[] {
    const nodes = sortByTime(childrenMap.get(parentId) ?? [])
    return nodes.map(node => ({
      node,
      depth,
      children: walk(node.id, depth + 1),
    }))
  }

  return walk(null, 0)
}

/** 从根到目标节点的路径 id 列表 */
export function pathToNode(entries: SessionTreeNode[], targetId: string): string[] {
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const path: string[] = []
  let current: SessionTreeNode | undefined = byId.get(targetId)
  while (current) {
    path.unshift(current.id)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}

export function isNodeOnActivePath(entries: SessionTreeNode[], leafId: string | null, nodeId: string): boolean {
  if (!leafId) return false
  return pathToNode(entries, leafId).includes(nodeId)
}

export function nodeLabel(node: SessionTreeNode): string {
  switch (node.type) {
    case 'message':
      return node.preview || node.role
    case 'branch_summary':
      return node.summary || 'branch'
  }
}

function sortEntriesByTime(entries: SessionTreeNode[]): SessionTreeNode[] {
  return [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

function findAssistantChild(userId: string, childrenMap: Map<string, SessionTreeNode[]>): SessionTreeNode | undefined {
  return sortEntriesByTime(childrenMap.get(userId) ?? []).find(child => child.type === 'message' && child.role === 'assistant')
}

function findTurnIdForEntry(entryId: string, byId: Map<string, SessionTreeNode>): string | null {
  let current: SessionTreeNode | undefined = byId.get(entryId)
  while (current) {
    if (current.type === 'branch_summary') return current.id
    if (current.type === 'message' && current.role === 'user') return current.id
    if (current.type === 'message' && current.role === 'assistant') {
      current = current.parentId ? byId.get(current.parentId) : undefined
      continue
    }
    break
  }
  return null
}

function resolveParentTurnId(entry: SessionTreeNode, byId: Map<string, SessionTreeNode>): string | null {
  if (!entry.parentId) return null
  return findTurnIdForEntry(entry.parentId, byId)
}

/** 将 message / branch_summary 合并为对话轮次树 */
export function buildSessionTurns(entries: SessionTreeNode[]): SessionTurn[] {
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  const childrenMap = new Map<string, SessionTreeNode[]>()

  for (const entry of entries) {
    const siblings = childrenMap.get(entry.parentId ?? '__root__') ?? []
    siblings.push(entry)
    childrenMap.set(entry.parentId ?? '__root__', siblings)
  }

  const turns = new Map<string, SessionTurn>()

  for (const entry of entries) {
    if (entry.type === 'message' && entry.role === 'user') {
      const assistant = findAssistantChild(entry.id, childrenMap)
      turns.set(entry.id, {
        id: entry.id,
        entryId: assistant?.id ?? entry.id,
        userPreview: entry.preview,
        assistantPreview: assistant && assistant.type === 'message' ? assistant.preview : undefined,
        entryIds: assistant ? [entry.id, assistant.id] : [entry.id],
        timestamp: entry.timestamp,
        parentTurnId: resolveParentTurnId(entry, byId),
        children: [],
      })
      continue
    }

    if (entry.type === 'branch_summary') {
      turns.set(entry.id, {
        id: entry.id,
        entryId: entry.id,
        branchSummary: entry.summary,
        entryIds: [entry.id],
        timestamp: entry.timestamp,
        parentTurnId: resolveParentTurnId(entry, byId),
        children: [],
      })
    }
  }

  for (const turn of turns.values()) {
    if (!turn.parentTurnId) continue
    const parent = turns.get(turn.parentTurnId)
    if (parent) parent.children.push(turn)
  }

  for (const turn of turns.values()) {
    turn.children.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }

  return [...turns.values()]
    .filter(turn => !turn.parentTurnId || !turns.has(turn.parentTurnId))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

export function isTurnOnActivePath(activeMessagePathIds: string[], turn: SessionTurn): boolean {
  return activeMessagePathIds.includes(turn.id)
}

function layoutTurnGraph(turns: SessionTurn[]): Map<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'TB', nodesep: 28, ranksep: 56, marginx: 16, marginy: 16 })

  const visit = (turn: SessionTurn) => {
    graph.setNode(turn.id, { width: SESSION_TURN_NODE_WIDTH, height: SESSION_TURN_NODE_HEIGHT })
    for (const child of turn.children) {
      graph.setEdge(turn.id, child.id)
      visit(child)
    }
  }

  for (const root of turns) visit(root)
  dagre.layout(graph)

  const positions = new Map<string, { x: number; y: number }>()
  for (const turnId of graph.nodes()) {
    const node = graph.node(turnId)
    positions.set(turnId, {
      x: node.x - SESSION_TURN_NODE_WIDTH / 2,
      y: node.y - SESSION_TURN_NODE_HEIGHT / 2,
    })
  }
  return positions
}

export function buildSessionTurnFlowGraph(options: {
  entries: SessionTreeNode[]
  activeMessagePathIds: string[]
  disabled: boolean
  onNavigate: (entryId: string) => void
  onFork: (entryId: string) => void
}): { nodes: Node<SessionTurnFlowNodeData>[]; edges: Edge[] } {
  const roots = buildSessionTurns(options.entries)
  if (roots.length === 0) return { nodes: [], edges: [] }

  const positions = layoutTurnGraph(roots)
  const nodes: Node<SessionTurnFlowNodeData>[] = []
  const edges: Edge[] = []

  const visit = (turn: SessionTurn) => {
    const position = positions.get(turn.id) ?? { x: 0, y: 0 }
    nodes.push({
      id: turn.id,
      type: SESSION_TURN_NODE_TYPE,
      position,
      style: { width: SESSION_TURN_NODE_WIDTH, height: SESSION_TURN_NODE_HEIGHT },
      className: 'nodrag nopan session-tree-turn-node',
      data: {
        turn,
        active: isTurnOnActivePath(options.activeMessagePathIds, turn),
        disabled: options.disabled,
        onNavigate: options.onNavigate,
        onFork: options.onFork,
      },
    })

    for (const child of turn.children) {
      edges.push({
        id: `${turn.id}->${child.id}`,
        source: turn.id,
        target: child.id,
        type: 'smoothstep',
        animated: isTurnOnActivePath(options.activeMessagePathIds, turn) && isTurnOnActivePath(options.activeMessagePathIds, child),
      })
      visit(child)
    }
  }

  for (const root of roots) visit(root)
  return { nodes, edges }
}
