import { useCallback } from 'react'
import { Group, Panel, usePanelRef } from 'react-resizable-panels'
import { Outlet } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { MainHeader } from '@/components/layout/main-header'
import { SidebarResizeHandle } from '@/components/layout/sidebar-resize-handle'
import { appHeaderRightItems } from '@/constants/app-header'
import { appSidebarItems } from '@/constants/app-sidebar'
import {
  MAIN_MIN_WIDTH,
  MAIN_PANEL_ID,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_PANEL_ID,
} from '@/constants/sidebar-layout'
import { useSidebarStore } from '@/stores/sidebar'

export function AppLayout() {
  const sidebarPanelRef = usePanelRef()
  const sidebarOpen = useSidebarStore((state) => state.open)
  const setSidebarOpen = useSidebarStore((state) => state.setOpen)

  const handleSidebarToggle = useCallback(() => {
    const panel = sidebarPanelRef.current
    if (!panel) return

    if (panel.isCollapsed()) {
      panel.expand()
      setSidebarOpen(true)
      return
    }

    panel.collapse()
    setSidebarOpen(false)
  }, [setSidebarOpen, sidebarPanelRef])

  const handleSidebarResize = useCallback(
    (size: { inPixels: number }) => {
      setSidebarOpen(size.inPixels > 0)
    },
    [setSidebarOpen],
  )

  return (
    <Group orientation="horizontal" className="h-screen">
      <Panel
        id={SIDEBAR_PANEL_ID}
        panelRef={sidebarPanelRef}
        defaultSize={SIDEBAR_DEFAULT_WIDTH}
        minSize={SIDEBAR_MIN_WIDTH}
        maxSize={SIDEBAR_MAX_WIDTH}
        collapsible
        collapsedSize={0}
        className="flex h-full min-h-0 flex-col bg-sidebar"
        onResize={handleSidebarResize}
      >
        <AppSidebar
          items={[...appSidebarItems]}
          open={sidebarOpen}
          onToggle={handleSidebarToggle}
        />
      </Panel>

      <SidebarResizeHandle disabled={!sidebarOpen} />

      <Panel id={MAIN_PANEL_ID} minSize={MAIN_MIN_WIDTH} className="flex h-full min-h-0 min-w-0 flex-col bg-background">
        <div className="flex h-full min-w-0 flex-col">
          <MainHeader
            sidebarOpen={sidebarOpen}
            onSidebarToggle={handleSidebarToggle}
            right={[...appHeaderRightItems]}
          />
          <div className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </div>
      </Panel>
    </Group>
  )
}
