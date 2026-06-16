import { RightPanelContent } from '@/components/layout/right-panel/right-panel-content'
import { RightPanelTopBar } from '@/components/layout/right-panel/right-panel-top-bar'

export function RightPanel() {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-background">
      <RightPanelTopBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <RightPanelContent />
      </div>
    </aside>
  )
}
