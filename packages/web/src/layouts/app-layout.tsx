import { Outlet } from 'react-router-dom'
import { AppHeader } from '@/components/layout/app-header'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { appHeaderLeftItems, appHeaderRightItems } from '@/constants/app-header'
import { appSidebarItems } from '@/constants/app-sidebar'
import { useSidebarStore } from '@/stores/sidebar'

export function AppLayout() {
  const sidebarOpen = useSidebarStore((state) => state.open)
  const toggleSidebar = useSidebarStore((state) => state.toggle)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <AppHeader
        left={[...appHeaderLeftItems]}
        right={[...appHeaderRightItems]}
        onSidebarToggle={toggleSidebar}
      />
      <div className="flex min-h-0 flex-1">
        {sidebarOpen ? <AppSidebar items={[...appSidebarItems]} /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
