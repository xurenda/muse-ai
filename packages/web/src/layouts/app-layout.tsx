import { useCallback, useRef, useState } from 'react'
import { Group, Panel, usePanelRef } from 'react-resizable-panels'
import { useLocation } from 'react-router-dom'
import { DeviceStatusBar } from '@/components/layout/device-status-bar'
import { DeviceStatusController } from '@/components/layout/device-status-controller'
import { MainContentShell } from '@/components/layout/main-content-shell'
import { SettingsSidebar } from '@/components/layout/settings-sidebar'
import { SidebarResizeHandle } from '@/components/layout/sidebar-resize-handle'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { appSidebarItems } from '@/constants/app-sidebar'
import { MAIN_MIN_WIDTH, MAIN_PANEL_ID, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_PANEL_ID } from '@/constants/sidebar-layout'
import { ChatSessionProvider } from '@/context/chat-session-context'
import { persistPanelLayout } from '@/lib/panel-resize'
import { useSidebarStore } from '@/stores/sidebar'

function MainPanelContent() {
  const location = useLocation()
  const isSettingsRoute = location.pathname.startsWith('/settings')
  const sidebarPanelRef = usePanelRef()
  const skipSidebarLayoutPersistRef = useRef(true)
  const [sidebarDefaultWidth] = useState(() => useSidebarStore.getState().width)
  const sidebarOpen = useSidebarStore(state => state.open)
  const setSidebarOpen = useSidebarStore(state => state.setOpen)
  const setSidebarWidth = useSidebarStore(state => state.setWidth)

  const handleSidebarToggle = useCallback(() => {
    const panel = sidebarPanelRef.current
    if (!panel) return

    if (panel.isCollapsed()) {
      setSidebarOpen(true)
      panel.expand()
      panel.resize(useSidebarStore.getState().width)
      return
    }

    panel.collapse()
    setSidebarOpen(false)
  }, [setSidebarOpen, sidebarPanelRef])

  const handleSidebarLayoutChanged = useCallback(() => {
    persistPanelLayout(skipSidebarLayoutPersistRef, sidebarPanelRef.current, {
      setOpen: setSidebarOpen,
      setWidth: setSidebarWidth,
    })
  }, [setSidebarOpen, setSidebarWidth, sidebarPanelRef])

  return (
    <Group orientation="horizontal" className="h-full min-h-0" onLayoutChanged={handleSidebarLayoutChanged}>
      <Panel
        id={SIDEBAR_PANEL_ID}
        panelRef={sidebarPanelRef}
        defaultSize={sidebarOpen ? sidebarDefaultWidth : 0}
        minSize={SIDEBAR_MIN_WIDTH}
        maxSize={SIDEBAR_MAX_WIDTH}
        collapsible
        collapsedSize={0}
        className="flex h-full min-h-0 flex-col bg-sidebar"
      >
        {isSettingsRoute ? (
          <SettingsSidebar open={sidebarOpen} onToggle={handleSidebarToggle} />
        ) : (
          <AppSidebar items={appSidebarItems} open={sidebarOpen} onToggle={handleSidebarToggle} />
        )}
      </Panel>

      <SidebarResizeHandle disabled={!sidebarOpen} />

      <Panel id={MAIN_PANEL_ID} minSize={MAIN_MIN_WIDTH} className="flex h-full min-h-0 min-w-0 flex-col bg-background">
        <ChatSessionProvider>
          <MainContentShell sidebarOpen={sidebarOpen} onSidebarToggle={handleSidebarToggle} />
        </ChatSessionProvider>
      </Panel>
    </Group>
  )
}

export function AppLayout() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DeviceStatusController />
      <div className="min-h-0 flex-1">
        <MainPanelContent />
      </div>
      <DeviceStatusBar />
    </div>
  )
}
