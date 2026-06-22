import { useCallback } from 'react'
import { Group, Panel, usePanelRef } from 'react-resizable-panels'
import { useLocation } from 'react-router-dom'
import { ChatDeviceStatusBridge } from '@/components/layout/chat-device-status-bridge'
import { ChatStatusBarModelPicker } from '@/components/layout/chat-status-bar-model-picker'
import { DeviceStatusBar } from '@/components/layout/device-status-bar'
import { DeviceStatusController } from '@/components/layout/device-status-controller'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { MainContentShell } from '@/components/layout/main-content-shell'
import { SettingsSidebar } from '@/components/layout/settings-sidebar'
import { SidebarResizeHandle } from '@/components/layout/sidebar-resize-handle'
import { appSidebarItems } from '@/constants/app-sidebar'
import { MAIN_MIN_WIDTH, MAIN_PANEL_ID, SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_PANEL_ID } from '@/constants/sidebar-layout'
import { ChatSessionProvider } from '@/context/chat-session-context'
import { useSidebarStore } from '@/stores/sidebar'

function MainPanelContent() {
  const location = useLocation()
  const isChatRoute = location.pathname === '/chat' || location.pathname.startsWith('/chat/')
  const isSettingsRoute = location.pathname.startsWith('/settings')
  const sidebarPanelRef = usePanelRef()
  const sidebarOpen = useSidebarStore(state => state.open)
  const setSidebarOpen = useSidebarStore(state => state.setOpen)

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

  const mainInner = <MainContentShell sidebarOpen={sidebarOpen} onSidebarToggle={handleSidebarToggle} />

  return (
    <Group orientation="horizontal" className="h-full min-h-0">
      <Panel
        id={SIDEBAR_PANEL_ID}
        panelRef={sidebarPanelRef}
        defaultSize={sidebarOpen ? SIDEBAR_DEFAULT_WIDTH : 0}
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
          <AppSidebar items={appSidebarItems} open={sidebarOpen} onToggle={handleSidebarToggle} />
        )}
      </Panel>

      <SidebarResizeHandle disabled={!sidebarOpen} />

      <Panel id={MAIN_PANEL_ID} minSize={MAIN_MIN_WIDTH} className="flex h-full min-h-0 min-w-0 flex-col bg-background">
        {isChatRoute ? (
          <ChatSessionProvider>
            <ChatDeviceStatusBridge />
            <ChatStatusBarModelPicker />
            {mainInner}
          </ChatSessionProvider>
        ) : (
          mainInner
        )}
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
