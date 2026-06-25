import { useCallback, useEffect, useRef, useState } from 'react'
import { Group, Panel, usePanelRef, type PanelImperativeHandle } from 'react-resizable-panels'
import { Outlet } from 'react-router-dom'
import { MainHeader } from '@/components/layout/main-header'
import { RightPanel } from '@/components/layout/right-panel/right-panel'
import { SidebarResizeHandle } from '@/components/layout/sidebar-resize-handle'
import { MAIN_CONTENT_PANEL_ID, MAIN_MIN_WIDTH, RIGHT_PANEL_ID, RIGHT_PANEL_MAX_WIDTH, RIGHT_PANEL_MIN_WIDTH } from '@/constants/sidebar-layout'
import { useRightPanelRoute } from '@/hooks/use-right-panel-route'
import { persistPanelLayout } from '@/lib/panel-resize'
import { useRightPanelStore } from '@/stores/right-panel'

interface MainContentShellProps {
  sidebarOpen: boolean
  onSidebarToggle: () => void
}

interface PanelLike {
  collapse: () => void
  expand: () => void
  isCollapsed: () => boolean
  resize: (size: number) => void
}

function syncPanelOpen(panel: PanelLike | null, open: boolean, width: number): void {
  if (!panel) return
  try {
    if (!open) {
      if (!panel.isCollapsed()) panel.collapse()
      return
    }

    if (panel.isCollapsed()) {
      panel.expand()
      panel.resize(width)
    }
  } catch {
    // Panel 尚未就绪时忽略
  }
}

export function MainContentShell({ sidebarOpen, onSidebarToggle }: MainContentShellProps) {
  useRightPanelRoute()

  const rightPanelRef = usePanelRef()
  const skipRightPanelLayoutPersistRef = useRef(true)
  const [rightPanelDefaultWidth] = useState(() => useRightPanelStore.getState().width)
  const rightPanelOpen = useRightPanelStore(state => state.open)
  const rightPanelFullscreen = useRightPanelStore(state => state.fullscreen)
  const setRightPanelOpen = useRightPanelStore(state => state.setOpen)
  const setRightPanelWidth = useRightPanelStore(state => state.setWidth)
  const skipInitialOpenSyncRef = useRef(true)

  useEffect(() => {
    if (skipInitialOpenSyncRef.current) {
      skipInitialOpenSyncRef.current = false
      return
    }

    syncPanelOpen(rightPanelRef.current as PanelImperativeHandle | null, rightPanelOpen && !rightPanelFullscreen, useRightPanelStore.getState().width)
  }, [rightPanelOpen, rightPanelFullscreen, rightPanelRef])

  const handleRightPanelLayoutChanged = useCallback(() => {
    persistPanelLayout(skipRightPanelLayoutPersistRef, rightPanelRef.current, {
      setOpen: setRightPanelOpen,
      setWidth: setRightPanelWidth,
      shouldSkip: () => useRightPanelStore.getState().fullscreen,
    })
  }, [rightPanelRef, setRightPanelOpen, setRightPanelWidth])

  const showRightPanelOverlay = rightPanelOpen && rightPanelFullscreen
  const showRightPanel = rightPanelOpen && !rightPanelFullscreen

  return (
    <div className="relative h-full min-h-0">
      <Group orientation="horizontal" className="h-full min-h-0" onLayoutChanged={handleRightPanelLayoutChanged}>
        <Panel id={MAIN_CONTENT_PANEL_ID} minSize={MAIN_MIN_WIDTH} className="flex min-h-0 min-w-0 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <MainHeader sidebarOpen={sidebarOpen} onSidebarToggle={onSidebarToggle} />
            <div className="flex min-h-0 flex-1 flex-col pt-11">
              <Outlet />
            </div>
          </div>
        </Panel>

        <SidebarResizeHandle disabled={!showRightPanel} />
        <Panel
          id={RIGHT_PANEL_ID}
          panelRef={rightPanelRef}
          defaultSize={showRightPanel ? rightPanelDefaultWidth : 0}
          minSize={RIGHT_PANEL_MIN_WIDTH}
          maxSize={RIGHT_PANEL_MAX_WIDTH}
          collapsible
          collapsedSize={0}
          className="flex min-h-0 flex-col bg-background"
        >
          {showRightPanel ? <RightPanel /> : null}
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
