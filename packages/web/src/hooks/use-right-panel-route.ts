import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useRightPanelStore } from '@/stores/right-panel'

/** 路由变化时同步右侧边栏可用 tab、active tab 与开合状态 */
export function useRightPanelRoute() {
  const { pathname } = useLocation()
  const syncRoute = useRightPanelStore(state => state.syncRoute)

  useEffect(() => {
    syncRoute(pathname)
  }, [pathname, syncRoute])
}
