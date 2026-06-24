import { Panel, useReactFlow, useStore } from '@xyflow/react'
import { Maximize2, Minus, Plus } from 'lucide-react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { VerticalControlButton, VerticalControlPanelWithTooltips } from '@/components/ui/vertical-control-panel'
import { useSessionTreeFitViewTop } from '@/components/chat/session-tree-flow-auto-fit'

interface SessionTreeFlowControlsProps {
  containerRef: RefObject<HTMLElement | null>
}

const zoomSelector = (state: { transform: [number, number, number]; minZoom: number; maxZoom: number }) => ({
  minZoomReached: state.transform[2] <= state.minZoom,
  maxZoomReached: state.transform[2] >= state.maxZoom,
})

export function SessionTreeFlowControls({ containerRef }: SessionTreeFlowControlsProps) {
  const { t } = useTranslation('chat')
  const { zoomIn, zoomOut } = useReactFlow()
  const fitViewTop = useSessionTreeFitViewTop(containerRef)
  const { minZoomReached, maxZoomReached } = useStore(zoomSelector)

  return (
    <Panel position="bottom-left" className="!m-3 !border-0 !bg-transparent !p-0 !shadow-none">
      <VerticalControlPanelWithTooltips>
        <VerticalControlButton
          isFirst
          tooltip={t('sessionTreeZoomIn')}
          tooltipSide="right"
          disabled={maxZoomReached}
          aria-label={t('sessionTreeZoomIn')}
          onClick={() => zoomIn()}
        >
          <Plus className="size-3.5" strokeWidth={2} />
        </VerticalControlButton>
        <VerticalControlButton
          tooltip={t('sessionTreeZoomOut')}
          tooltipSide="right"
          disabled={minZoomReached}
          aria-label={t('sessionTreeZoomOut')}
          onClick={() => zoomOut()}
        >
          <Minus className="size-3.5" strokeWidth={2} />
        </VerticalControlButton>
        <VerticalControlButton tooltip={t('sessionTreeFitView')} tooltipSide="right" aria-label={t('sessionTreeFitView')} onClick={fitViewTop}>
          <Maximize2 className="size-3.5" strokeWidth={2} />
        </VerticalControlButton>
      </VerticalControlPanelWithTooltips>
    </Panel>
  )
}
