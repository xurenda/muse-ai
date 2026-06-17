import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { SessionTreeResponse } from '@muse-ai/shared'
import { ReactFlow, Background, useEdgesState, useNodesState, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { SessionTreeFlowAutoFit } from '@/components/chat/session-tree-flow-auto-fit'
import { SessionTreeFlowControls } from '@/components/chat/session-tree-flow-controls'
import { SessionTreeMiniMap } from '@/components/chat/session-tree-minimap'
import { SessionTreeTurnNode } from '@/components/chat/session-tree-turn-node'
import { buildSessionTurnFlowGraph, SESSION_TURN_NODE_TYPE, type SessionTurnFlowNodeData } from '@/lib/session-tree-utils'

interface SessionTreePanelProps {
  tree: SessionTreeResponse | null
  disabled: boolean
  onNavigate: (entryId: string | null) => void
  onFork: (entryId: string) => void
}

const nodeTypes = {
  [SESSION_TURN_NODE_TYPE]: SessionTreeTurnNode,
}

export function SessionTreePanel({ tree, disabled, onNavigate, onFork }: SessionTreePanelProps) {
  const { t } = useTranslation('chat')
  const flowContainerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<SessionTurnFlowNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const handleNavigate = useCallback(
    (entryId: string) => {
      void onNavigate(entryId)
    },
    [onNavigate],
  )

  const handleFork = useCallback(
    (entryId: string) => {
      void onFork(entryId)
    },
    [onFork],
  )

  const graph = useMemo(() => {
    if (!tree) return { nodes: [], edges: [] }
    return buildSessionTurnFlowGraph({
      entries: tree.entries,
      activeMessagePathIds: tree.activeMessagePathIds,
      disabled,
      onNavigate: handleNavigate,
      onFork: handleFork,
    })
  }, [tree, disabled, handleNavigate, handleFork])

  useEffect(() => {
    setNodes(graph.nodes)
    setEdges(graph.edges)
  }, [graph, setNodes, setEdges])

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="px-3 pb-2 pt-1">
        <p className="text-[11px] text-muted-foreground">{t('sessionTreeHint')}</p>
      </div>
      <div ref={flowContainerRef} className="min-h-0 flex-1">
        {!tree || graph.nodes.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">{t('sessionTreeEmpty')}</p>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnScroll
            zoomOnScroll
            minZoom={0.4}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
            className="session-tree-flow bg-background"
          >
            <SessionTreeFlowAutoFit containerRef={flowContainerRef} nodeCount={graph.nodes.length} />
            <Background gap={16} size={1} color="var(--border)" />
            <SessionTreeMiniMap pannable zoomable nodeCount={graph.nodes.length} />
            <SessionTreeFlowControls containerRef={flowContainerRef} />
          </ReactFlow>
        )}
      </div>
    </aside>
  )
}
