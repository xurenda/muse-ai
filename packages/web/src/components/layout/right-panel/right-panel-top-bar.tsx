import { RightPanelAddMenu } from '@/components/layout/right-panel/right-panel-add-menu'
import { RightPanelTabList } from '@/components/layout/right-panel/right-panel-tab-list'
import { RightPanelToolbar } from '@/components/layout/right-panel-toolbar'
import { useRightPanelStore } from '@/stores/right-panel'

export function RightPanelTopBar() {
  const rightPanelFullscreen = useRightPanelStore(state => state.fullscreen)
  const toggleRightPanelFullscreen = useRightPanelStore(state => state.toggleFullscreen)
  const setRightPanelOpen = useRightPanelStore(state => state.setOpen)

  return (
    <div className="flex h-11 shrink-0 items-center gap-1 px-1">
      <RightPanelTabList />
      <div className="min-w-0 flex-1" />
      <RightPanelAddMenu />
      <RightPanelToolbar fullscreen={rightPanelFullscreen} onToggleFullscreen={toggleRightPanelFullscreen} onCollapse={() => setRightPanelOpen(false)} />
    </div>
  )
}
