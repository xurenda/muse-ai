import type { SessionTreeNode } from '@muse-ai/shared'

export interface SessionTreeItem {
  node: SessionTreeNode
  children: SessionTreeItem[]
  depth: number
}

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
    case 'label':
      return node.label || 'label'
    case 'model_change':
      return `${node.provider}/${node.modelId}`
    case 'thinking_level_change':
      return `thinking: ${node.thinkingLevel}`
    case 'session_info':
      return node.summary || 'session'
    default:
      return node.summary || node.type
  }
}
