import { useCallback, useEffect } from 'react'
import { Group, Panel, usePanelRef, type PanelImperativeHandle } from 'react-resizable-panels'
import { matchPath, Outlet, useLocation } from 'react-router-dom'
import { ChatSessionTreePanel } from '@/components/chat/chat-session-tree-panel'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { MainHeader } from '@/components/layout/main-header'
import { SettingsSidebar } from '@/components/layout/settings-sidebar'
import { SidebarResizeHandle } from '@/components/layout/sidebar-resize-handle'
import { appSidebarItems } from '@/constants/app-sidebar'
import {
  CHAT_MAIN_PANEL_ID,
  MAIN_MIN_WIDTH,
  MAIN_PANEL_ID,
  SESSION_TREE_DEFAULT_WIDTH,
  SESSION_TREE_MAX_WIDTH,
  SESSION_TREE_MIN_WIDTH,
  SESSION_TREE_PANEL_ID,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_PANEL_ID,
} from '@/constants/sidebar-layout'
import { ChatSessionProvider } from '@/context/chat-session-context'
import { useSessionTreePanelStore } from '@/stores/session-tree-panel'
import { useSidebarStore } from '@/stores/sidebar'

interface PanelLike {
  collapse: () => void
  expand: () => void
  isCollapsed: () => boolean
}

/** Panel ref 可能在 Group 注册完成前即可用，imperative API 会抛错 */
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

function ChatRouteShell() {
  const location = useLocation()
  const hasSessionTree = Boolean(matchPath('/chat/:sessionId', location.pathname))
  const sessionTreePanelRef = usePanelRef()
  const sessionTreeOpen = useSessionTreePanelStore(state => state.open)
  const setSessionTreeOpen = useSessionTreePanelStore(state => state.setOpen)

  useEffect(() => {
    const panel = sessionTreePanelRef.current as PanelImperativeHandle | null
    const targetCollapsed = !hasSessionTree || !sessionTreeOpen

    if (setPanelCollapsed(panel, targetCollapsed)) return

    const frameId = requestAnimationFrame(() => {
      setPanelCollapsed(sessionTreePanelRef.current as PanelImperativeHandle | null, targetCollapsed)
    })

    return () => cancelAnimationFrame(frameId)
  }, [hasSessionTree, sessionTreeOpen, sessionTreePanelRef])

  const handleSessionTreeResize = useCallback(
    (size: { inPixels: number }) => {
      setSessionTreeOpen(size.inPixels > 0)
    },
    [setSessionTreeOpen],
  )

  return (
    <ChatSessionProvider>
      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel id={CHAT_MAIN_PANEL_ID} minSize={MAIN_MIN_WIDTH} className="flex min-h-0 min-w-0 flex-col">
          <Outlet />
        </Panel>

        <SidebarResizeHandle disabled={!hasSessionTree || !sessionTreeOpen} />
        <Panel
          id={SESSION_TREE_PANEL_ID}
          panelRef={sessionTreePanelRef}
          defaultSize={hasSessionTree && sessionTreeOpen ? SESSION_TREE_DEFAULT_WIDTH : 0}
          minSize={SESSION_TREE_MIN_WIDTH}
          maxSize={SESSION_TREE_MAX_WIDTH}
          collapsible
          collapsedSize={0}
          className="flex min-h-0 flex-col bg-background"
          onResize={handleSessionTreeResize}
        >
          {hasSessionTree ? <ChatSessionTreePanel /> : null}
        </Panel>
      </Group>
    </ChatSessionProvider>
  )
}

export function AppLayout() {
  const location = useLocation()
  const isChatRoute = location.pathname === '/chat' || location.pathname.startsWith('/chat/')
  const isSettingsRoute = location.pathname.startsWith('/settings')
  const hasSessionTree = Boolean(matchPath('/chat/:sessionId', location.pathname))
  const sidebarPanelRef = usePanelRef()
  const sidebarOpen = useSidebarStore(state => state.open)
  const setSidebarOpen = useSidebarStore(state => state.setOpen)
  const sessionTreeOpen = useSessionTreePanelStore(state => state.open)
  const setSessionTreeOpen = useSessionTreePanelStore(state => state.setOpen)

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

  const handleSessionTreeToggle = useCallback(() => {
    setSessionTreeOpen(!sessionTreeOpen)
  }, [sessionTreeOpen, setSessionTreeOpen])

  return (
    <Group orientation="horizontal" className="h-full">
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
        <div className="relative flex h-full min-w-0 flex-col">
          <MainHeader
            sidebarOpen={sidebarOpen}
            onSidebarToggle={handleSidebarToggle}
            sessionTreeOpen={sessionTreeOpen}
            onSessionTreeToggle={handleSessionTreeToggle}
            showSessionTreeToggle={hasSessionTree}
          />
          <div className="flex min-h-0 flex-1 flex-col pt-11">{isChatRoute ? <ChatRouteShell /> : <Outlet />}</div>
        </div>
      </Panel>
    </Group>
  )
}
