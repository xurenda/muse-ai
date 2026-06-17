import { describe, expect, it, vi } from 'vitest'
import type { SessionTreeNode } from '@muse-ai/shared'
import { buildSessionTurnFlowGraph, buildSessionTurns, isTurnOnActivePath } from '@/lib/session-tree-utils'

function user(id: string, parentId: string | null, preview: string, timestamp: string): SessionTreeNode {
  return { id, parentId, timestamp, type: 'message', role: 'user', preview }
}

function assistant(id: string, parentId: string, preview: string, timestamp: string): SessionTreeNode {
  return { id, parentId, timestamp, type: 'message', role: 'assistant', preview }
}

describe('session-tree-utils', () => {
  it('buildSessionTurns 应将 user 与 assistant 合并为单轮次', () => {
    const entries: SessionTreeNode[] = [
      user('u1', null, '你好', '2026-01-01T00:00:00.000Z'),
      assistant('a1', 'u1', '你好！', '2026-01-01T00:00:01.000Z'),
      user('u2', 'a1', '再问一句', '2026-01-01T00:00:02.000Z'),
      assistant('a2', 'u2', '收到', '2026-01-01T00:00:03.000Z'),
    ]

    const turns = buildSessionTurns(entries)
    expect(turns).toHaveLength(1)
    expect(turns[0]?.id).toBe('u1')
    expect(turns[0]?.entryId).toBe('a1')
    expect(turns[0]?.children).toHaveLength(1)
    expect(turns[0]?.children[0]?.entryId).toBe('a2')
    expect(turns[0]?.children[0]?.userPreview).toBe('再问一句')
  })

  it('buildSessionTurns 应保留分叉 sibling', () => {
    const entries: SessionTreeNode[] = [
      user('u1', null, '起点', '2026-01-01T00:00:00.000Z'),
      assistant('a1', 'u1', '回复一', '2026-01-01T00:00:01.000Z'),
      user('u2a', 'a1', '分支 A', '2026-01-01T00:00:02.000Z'),
      assistant('a2a', 'u2a', 'A 回复', '2026-01-01T00:00:03.000Z'),
      user('u2b', 'a1', '分支 B', '2026-01-01T00:00:04.000Z'),
      assistant('a2b', 'u2b', 'B 回复', '2026-01-01T00:00:05.000Z'),
    ]

    const turns = buildSessionTurns(entries)
    expect(turns[0]?.children.map(turn => turn.userPreview)).toEqual(['分支 A', '分支 B'])
  })

  it('buildSessionTurnFlowGraph 应生成节点与边', () => {
    const entries: SessionTreeNode[] = [user('u1', null, '你好', '2026-01-01T00:00:00.000Z'), assistant('a1', 'u1', '你好！', '2026-01-01T00:00:01.000Z')]

    const graph = buildSessionTurnFlowGraph({
      entries,
      activeMessagePathIds: ['u1'],
      disabled: false,
      onNavigate: vi.fn(),
      onFork: vi.fn(),
    })

    expect(graph.nodes).toHaveLength(1)
    expect(graph.edges).toHaveLength(0)
    expect(graph.nodes[0]?.data.active).toBe(true)
  })

  it('isTurnOnActivePath 应识别当前路径轮次', () => {
    const entries: SessionTreeNode[] = [
      user('u1', null, '你好', '2026-01-01T00:00:00.000Z'),
      assistant('a1', 'u1', '你好！', '2026-01-01T00:00:01.000Z'),
      user('u2', 'a1', '再问', '2026-01-01T00:00:02.000Z'),
      assistant('a2', 'u2', '收到', '2026-01-01T00:00:03.000Z'),
    ]
    const turns = buildSessionTurns(entries)
    const childTurn = turns[0]?.children[0]
    expect(childTurn).toBeDefined()
    expect(isTurnOnActivePath(['u1', 'a1', 'u2', 'a2'], childTurn!)).toBe(true)
    expect(isTurnOnActivePath(['u1', 'a1'], childTurn!)).toBe(false)
  })
})
