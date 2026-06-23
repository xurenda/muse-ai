import { Panel, useReactFlow, useStore } from '@xyflow/react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import type { ReactElement, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useSessionTreeFitViewTop } from '@/components/chat/session-tree-flow-auto-fit'

interface SessionTreeFlowControlsProps {
  containerRef: RefObject<HTMLElement | null>
}

const zoomSelector = (state: { transform: [number, number, number]; minZoom: number; maxZoom: number }) => ({
  minZoomReached: state.transform[2] <= state.minZoom,
  maxZoomReached: state.transform[2] >= state.maxZoom,
})

function ControlTooltip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function SessionTreeFlowControls({ containerRef }: SessionTreeFlowControlsProps) {
  const { t } = useTranslation('chat')
  const { zoomIn, zoomOut } = useReactFlow()
  const fitViewTop = useSessionTreeFitViewTop(containerRef)
  const { minZoomReached, maxZoomReached } = useStore(zoomSelector)

  return (
    <Panel
      position="bottom-left"
      className="!m-3 flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm [&_.react-flow__controls-button]:border-0 [&_.react-flow__controls-button]:bg-transparent"
    >
      <TooltipProvider>
        <ControlTooltip label={t('sessionTreeZoomIn')}>
          <button
            type="button"
            className="react-flow__controls-button flex items-center justify-center text-foreground disabled:opacity-40"
            disabled={maxZoomReached}
            aria-label={t('sessionTreeZoomIn')}
            onClick={() => zoomIn()}
          >
            <Plus className="size-3.5" strokeWidth={2} />
          </button>
        </ControlTooltip>
        <ControlTooltip label={t('sessionTreeZoomOut')}>
          <button
            type="button"
            className="react-flow__controls-button flex items-center justify-center border-t border-border text-foreground disabled:opacity-40"
            disabled={minZoomReached}
            aria-label={t('sessionTreeZoomOut')}
            onClick={() => zoomOut()}
          >
            <Minus className="size-3.5" strokeWidth={2} />
          </button>
        </ControlTooltip>
        <ControlTooltip label={t('sessionTreeFitView')}>
          <button
            type="button"
            className="react-flow__controls-button flex items-center justify-center border-t border-border text-foreground"
            aria-label={t('sessionTreeFitView')}
            onClick={fitViewTop}
          >
            <Maximize2 className="size-3.5" strokeWidth={2} />
          </button>
        </ControlTooltip>
      </TooltipProvider>
    </Panel>
  )
}
