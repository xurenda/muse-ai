import { useCallback } from 'react'
import { Group, Panel, usePanelRef } from 'react-resizable-panels'
import { Outlet, useLocation } from 'react-router-dom'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { RightSidebar } from '@/components/layout/right-sidebar'
import { SettingsSidebar } from '@/components/layout/settings-sidebar'
import { MainHeader } from '@/components/layout/main-header'
import { SidebarResizeHandle } from '@/components/layout/sidebar-resize-handle'
import { appHeaderRightItems } from '@/constants/app-header'
import { appSidebarItems } from '@/constants/app-sidebar'
import {
  MAIN_MIN_WIDTH,
  MAIN_PANEL_ID,
  RIGHT_SIDEBAR_MAX_WIDTH,
  RIGHT_SIDEBAR_MIN_WIDTH,
  RIGHT_SIDEBAR_PANEL_ID,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_PANEL_ID,
} from '@/constants/sidebar-layout'
import { useRightSidebarStore } from '@/stores/right-sidebar'
import { useSidebarStore } from '@/stores/sidebar'

export function AppLayout() {
  const { pathname } = useLocation()
  const isSettingsRoute = pathname.startsWith('/settings')
  const sidebarPanelRef = usePanelRef()
  const rightSidebarPanelRef = usePanelRef()
  const sidebarOpen = useSidebarStore((state) => state.open)
  const setSidebarOpen = useSidebarStore((state) => state.setOpen)
  const rightSidebarOpen = useRightSidebarStore((state) => state.open)
  const setRightSidebarOpen = useRightSidebarStore((state) => state.setOpen)

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

  const handleRightSidebarToggle = useCallback(() => {
    const panel = rightSidebarPanelRef.current
    if (!panel) return

    if (panel.isCollapsed()) {
      panel.expand()
      setRightSidebarOpen(true)
      return
    }

    panel.collapse()
    setRightSidebarOpen(false)
  }, [setRightSidebarOpen, rightSidebarPanelRef])

  const handleRightSidebarResize = useCallback(
    (size: { inPixels: number }) => {
      setRightSidebarOpen(size.inPixels > 0)
    },
    [setRightSidebarOpen],
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
        {isSettingsRoute ? (
          <SettingsSidebar open={sidebarOpen} onToggle={handleSidebarToggle} />
        ) : (
          <AppSidebar
            items={[...appSidebarItems]}
            open={sidebarOpen}
            onToggle={handleSidebarToggle}
          />
        )}
      </Panel>

      <SidebarResizeHandle disabled={!sidebarOpen} />

      <Panel id={MAIN_PANEL_ID} minSize={MAIN_MIN_WIDTH} className="flex h-full min-h-0 min-w-0 flex-col bg-background">
        <div className="relative flex h-full min-w-0 flex-col">
          <MainHeader
            sidebarOpen={sidebarOpen}
            onSidebarToggle={handleSidebarToggle}
            rightSidebarOpen={rightSidebarOpen}
            onRightSidebarToggle={handleRightSidebarToggle}
            right={[...appHeaderRightItems]}
          />
          <div className="flex min-h-0 flex-1 flex-col pt-11">
            <Outlet />
          </div>
        </div>
      </Panel>

      <SidebarResizeHandle disabled={!rightSidebarOpen} />

      <Panel
        id={RIGHT_SIDEBAR_PANEL_ID}
        panelRef={rightSidebarPanelRef}
        defaultSize={0}
        minSize={RIGHT_SIDEBAR_MIN_WIDTH}
        maxSize={RIGHT_SIDEBAR_MAX_WIDTH}
        collapsible
        collapsedSize={0}
        className="flex h-full min-h-0 flex-col bg-background"
        onResize={handleRightSidebarResize}
      >
        <RightSidebar
          open={rightSidebarOpen}
          onToggle={handleRightSidebarToggle}
          right={[...appHeaderRightItems]}
        />
      </Panel>
    </Group>
  )
}
