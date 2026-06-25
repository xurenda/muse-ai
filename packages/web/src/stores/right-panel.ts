import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  getAvailableTabTypesForPath,
  getDefaultTabTypeForPath,
  getRightPanelRouteKey,
  type RightPanelRouteKey,
  type RightPanelTabType,
} from '@/constants/right-panel-tabs'
import { clampRightPanelWidth, RIGHT_PANEL_DEFAULT_WIDTH } from '@/constants/sidebar-layout'

interface RightPanelState {
  open: boolean
  fullscreen: boolean
  width: number
  routeKey: RightPanelRouteKey | null
  availableTabTypes: RightPanelTabType[]
  activeTab: RightPanelTabType | null
  activeTabByRoute: Partial<Record<RightPanelRouteKey, RightPanelTabType>>
  setOpen: (open: boolean) => void
  setFullscreen: (fullscreen: boolean) => void
  toggleFullscreen: () => void
  setWidth: (width: number) => void
  setActiveTab: (type: RightPanelTabType) => void
  syncRoute: (pathname: string) => void
}

function resolveActiveTab(
  availableTypes: RightPanelTabType[],
  routeKey: RightPanelRouteKey | null,
  activeTabByRoute: Partial<Record<RightPanelRouteKey, RightPanelTabType>>,
  defaultTab: RightPanelTabType | null,
): RightPanelTabType | null {
  if (availableTypes.length === 0 || !routeKey) {
    return null
  }

  const saved = activeTabByRoute[routeKey]
  if (saved && availableTypes.includes(saved)) {
    return saved
  }

  if (defaultTab && availableTypes.includes(defaultTab)) {
    return defaultTab
  }

  return availableTypes[0] ?? null
}

export const useRightPanelStore = create<RightPanelState>()(
  persist(
    set => ({
      open: false,
      fullscreen: false,
      width: RIGHT_PANEL_DEFAULT_WIDTH,
      routeKey: null,
      availableTabTypes: [],
      activeTab: null,
      activeTabByRoute: {},
      setOpen: open =>
        set(state => ({
          open,
          fullscreen: open ? state.fullscreen : false,
        })),
      setFullscreen: fullscreen => set({ fullscreen }),
      toggleFullscreen: () => set(state => ({ fullscreen: !state.fullscreen })),
      setWidth: width => set({ width: clampRightPanelWidth(width) }),
      setActiveTab: type =>
        set(state => {
          if (!state.routeKey || !state.availableTabTypes.includes(type)) {
            return state
          }

          return {
            activeTab: type,
            activeTabByRoute: {
              ...state.activeTabByRoute,
              [state.routeKey]: type,
            },
          }
        }),
      syncRoute: pathname =>
        set(state => {
          const availableTabTypes = getAvailableTabTypesForPath(pathname)
          const routeKey = getRightPanelRouteKey(pathname)
          const defaultTab = getDefaultTabTypeForPath(pathname)
          const hasTabs = availableTabTypes.length > 0

          const activeTab = resolveActiveTab(availableTabTypes, routeKey, state.activeTabByRoute, defaultTab)

          let open = state.open
          if (!hasTabs) {
            open = false
          }

          const activeTabByRoute =
            activeTab && routeKey
              ? {
                  ...state.activeTabByRoute,
                  [routeKey]: activeTab,
                }
              : state.activeTabByRoute

          return {
            routeKey,
            availableTabTypes,
            activeTab,
            activeTabByRoute,
            open,
            fullscreen: open ? state.fullscreen : false,
          }
        }),
    }),
    {
      name: 'muse.rightPanel',
      partialize: state => ({
        open: state.open,
        width: state.width,
        activeTabByRoute: state.activeTabByRoute,
      }),
      onRehydrateStorage: () => state => {
        if (state) {
          state.width = clampRightPanelWidth(state.width)
        }
      },
    },
  ),
)
