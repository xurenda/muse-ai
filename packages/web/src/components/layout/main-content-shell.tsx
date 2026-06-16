import { useCallback, useEffect } from 'react'
import { Group, Panel, usePanelRef, type PanelImperativeHandle } from 'react-resizable-panels'
import { Outlet } from 'react-router-dom'
import { MainHeader } from '@/components/layout/main-header'
import { RightPanel } from '@/components/layout/right-panel/right-panel'
import { SidebarResizeHandle } from '@/components/layout/sidebar-resize-handle'
import {
  MAIN_CONTENT_PANEL_ID,
  MAIN_MIN_WIDTH,
  RIGHT_PANEL_DEFAULT_WIDTH,
  RIGHT_PANEL_ID,
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
} from '@/constants/sidebar-layout'
import { useRightPanelRoute } from '@/hooks/use-right-panel-route'
import { useRightPanelStore } from '@/stores/right-panel'

interface MainContentShellProps {
  sidebarOpen: boolean
  onSidebarToggle: () => void
}

interface PanelLike {
  collapse: () => void
  expand: () => void
  isCollapsed: () => boolean
}

function setPanelCollapsed(panel: PanelLike | null, collapsed: boolean): boolean {
  if (!panel) return false
  try {
    if (collapsed) {
      if (!panel.isCollapsed()) panel.collapse()
    } else if (panel.isCollapsed()) {
      panel.expand()
    }
    return true
  } catch {
    return false
  }
}

export function MainContentShell({ sidebarOpen, onSidebarToggle }: MainContentShellProps) {
  useRightPanelRoute()

  const rightPanelRef = usePanelRef()
  const rightPanelOpen = useRightPanelStore(state => state.open)
  const rightPanelFullscreen = useRightPanelStore(state => state.fullscreen)
  const setRightPanelOpen = useRightPanelStore(state => state.setOpen)

  useEffect(() => {
    const panel = rightPanelRef.current as PanelImperativeHandle | null
    const targetCollapsed = !rightPanelOpen

    if (setPanelCollapsed(panel, targetCollapsed)) return

    const frameId = requestAnimationFrame(() => {
      setPanelCollapsed(rightPanelRef.current as PanelImperativeHandle | null, targetCollapsed)
    })

    return () => cancelAnimationFrame(frameId)
  }, [rightPanelOpen, rightPanelRef])

  const handleRightPanelResize = useCallback(
    (size: { inPixels: number }) => {
      if (useRightPanelStore.getState().fullscreen) return
      setRightPanelOpen(size.inPixels > 0)
    },
    [setRightPanelOpen],
  )

  const showRightPanelOverlay = rightPanelOpen && rightPanelFullscreen

  return (
    <div className="relative h-full min-h-0">
      <Group orientation="horizontal" className="h-full min-h-0">
        <Panel id={MAIN_CONTENT_PANEL_ID} minSize={MAIN_MIN_WIDTH} className="flex min-h-0 min-w-0 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <MainHeader sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />
            <div className="flex min-h-0 flex-1 flex-col pt-11">
              <Outlet />
            </div>
          </div>
        </Panel>

        <SidebarResizeHandle disabled={!rightPanelOpen || rightPanelFullscreen} />
        <Panel
          id={RIGHT_PANEL_ID}
          panelRef={rightPanelRef}
          defaultSize={rightPanelOpen ? RIGHT_PANEL_DEFAULT_WIDTH : 0}
          minSize={RIGHT_PANEL_MIN_WIDTH}
          maxSize={RIGHT_PANEL_MAX_WIDTH}
          collapsible
          collapsedSize={0}
          className="flex min-h-0 flex-col bg-background"
          onResize={handleRightPanelResize}
        >
          {rightPanelOpen && !rightPanelFullscreen ? <RightPanel /> : null}
        </Panel>
      </Group>

      {showRightPanelOverlay ? (
        <div className="absolute inset-0 z-[1] flex min-h-0 flex-col bg-background">
          <RightPanel />
        </div>
      ) : null}
    </div>
  )
}
