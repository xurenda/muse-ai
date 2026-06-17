import { memo, useEffect, useState, type CSSProperties } from 'react'
import { MiniMap, type MiniMapNodeProps, type MiniMapProps } from '@xyflow/react'
import type { Node } from '@xyflow/react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { SessionTurnFlowNodeData } from '@/lib/session-tree-utils'

const MINIMAP_SELECTOR = '.session-tree-flow .session-tree-minimap'

type SessionTreeMiniMapProps = Omit<MiniMapProps<Node<SessionTurnFlowNodeData>>, 'ariaLabel' | 'nodeColor' | 'nodeComponent'> & {
  nodeCount: number
}

function resolveMiniMapNodeColor(node: Node<SessionTurnFlowNodeData>): string {
  return (node.data as SessionTurnFlowNodeData | undefined)?.active ? 'var(--primary)' : 'color-mix(in oklch, var(--muted-foreground) 38%, transparent)'
}

const SessionTreeMiniMapNode = memo(function SessionTreeMiniMapNode({ x, y, width, height, color }: MiniMapNodeProps) {
  return <rect x={x} y={y} width={width} height={height} rx={5} ry={5} fill={color} stroke="none" />
})

function useMiniMapTooltipAnchor(nodeCount: number): { open: boolean; setOpen: (open: boolean) => void; anchorStyle: CSSProperties } {
  const [open, setOpen] = useState(false)
  const [anchorStyle, setAnchorStyle] = useState<CSSProperties>({ display: 'none' })

  useEffect(() => {
    let element: HTMLElement | null = null
    let frameId = 0

    const show = (): void => {
      if (!element) return
      const rect = element.getBoundingClientRect()
      setAnchorStyle({
        position: 'fixed',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        pointerEvents: 'none',
      })
      setOpen(true)
    }

    const hide = (): void => setOpen(false)

    const bind = (): void => {
      const found = document.querySelector(MINIMAP_SELECTOR)
      if (!(found instanceof HTMLElement)) return
      element = found
      element.addEventListener('mouseenter', show)
      element.addEventListener('mouseleave', hide)
    }

    bind()
    if (!element) {
      frameId = requestAnimationFrame(bind)
    }

    return () => {
      cancelAnimationFrame(frameId)
      if (element) {
        element.removeEventListener('mouseenter', show)
        element.removeEventListener('mouseleave', hide)
      }
    }
  }, [nodeCount])

  return { open, setOpen, anchorStyle }
}

export function SessionTreeMiniMap({ nodeCount, ...props }: SessionTreeMiniMapProps) {
  const { t } = useTranslation('chat')
  const { open, setOpen, anchorStyle } = useMiniMapTooltipAnchor(nodeCount)

  return (
    <>
      <MiniMap
        {...props}
        ariaLabel=""
        nodeComponent={SessionTreeMiniMapNode}
        nodeColor={node => resolveMiniMapNodeColor(node as Node<SessionTurnFlowNodeData>)}
        nodeBorderRadius={5}
        nodeStrokeWidth={0}
        bgColor="transparent"
        maskColor="color-mix(in oklch, var(--foreground) 6%, transparent)"
        maskStrokeColor="var(--primary)"
        maskStrokeWidth={1.5}
        style={{ width: 168, height: 112, margin: 0 }}
        className="session-tree-minimap"
      />

      <TooltipProvider delayDuration={300}>
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <div style={anchorStyle} aria-hidden tabIndex={-1} />
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={6} className="px-1.5 py-0.5 text-xs">
            {t('sessionTreeMinimap')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  )
}
