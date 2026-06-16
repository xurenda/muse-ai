import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getAvailableTabTypesForPath, getDefaultTabTypesForPath } from '@/constants/right-panel-tabs'
import { useRightPanelStore } from '@/stores/right-panel'

/** 路由变化时同步右侧边栏可用 tab 与默认 tab */
export function useRightPanelRoute() {
  const { pathname } = useLocation()
  const syncRoute = useRightPanelStore(state => state.syncRoute)

  useEffect(() => {
    syncRoute(getAvailableTabTypesForPath(pathname), getDefaultTabTypesForPath(pathname))
  }, [pathname, syncRoute])
}
