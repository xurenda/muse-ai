import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RightPanelTabType } from '@/constants/right-panel-tabs'

export interface RightPanelTab {
  id: string
  type: RightPanelTabType
}

interface RightPanelState {
  open: boolean
  fullscreen: boolean
  tabs: RightPanelTab[]
  activeTabId: string | null
  availableTabTypes: RightPanelTabType[]
  setOpen: (open: boolean) => void
  setFullscreen: (fullscreen: boolean) => void
  toggleFullscreen: () => void
  syncRoute: (availableTypes: RightPanelTabType[], defaultTypes: RightPanelTabType[]) => void
  addTab: (type: RightPanelTabType) => void
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
}

function createTabId(type: RightPanelTabType): string {
  return `${type}-${crypto.randomUUID()}`
}

export const useRightPanelStore = create<RightPanelState>()(
  persist(
    set => ({
      open: true,
      fullscreen: false,
      tabs: [],
      activeTabId: null,
      availableTabTypes: [],
      setOpen: open =>
        set(state => ({
          open,
          fullscreen: open ? state.fullscreen : false,
        })),
      setFullscreen: fullscreen => set({ fullscreen }),
      toggleFullscreen: () => set(state => ({ fullscreen: !state.fullscreen })),
      syncRoute: (availableTypes, defaultTypes) => {
        set(state => {
          const tabs = state.tabs.filter(tab => availableTypes.includes(tab.type))
          for (const type of defaultTypes) {
            if (!tabs.some(tab => tab.type === type)) {
              tabs.push({ id: createTabId(type), type })
            }
          }
          const activeTabId = state.activeTabId && tabs.some(tab => tab.id === state.activeTabId) ? state.activeTabId : (tabs[0]?.id ?? null)
          return { availableTabTypes: availableTypes, tabs, activeTabId }
        })
      },
      addTab: type => {
        set(state => {
          if (!state.availableTabTypes.includes(type)) return state
          if (state.tabs.some(tab => tab.type === type)) {
            const existing = state.tabs.find(tab => tab.type === type)
            return existing ? { activeTabId: existing.id } : state
          }
          const tab: RightPanelTab = { id: createTabId(type), type }
          return {
            tabs: [...state.tabs, tab],
            activeTabId: tab.id,
          }
        })
      },
      removeTab: id => {
        set(state => {
          const index = state.tabs.findIndex(tab => tab.id === id)
          if (index === -1) return state
          const tabs = state.tabs.filter(tab => tab.id !== id)
          let activeTabId = state.activeTabId
          if (activeTabId === id) {
            const nextTab = tabs[index] ?? tabs[index - 1] ?? null
            activeTabId = nextTab?.id ?? null
          }
          return { tabs, activeTabId }
        })
      },
      setActiveTab: id => set({ activeTabId: id }),
    }),
    {
      name: 'muse-ai:right-panel',
      partialize: state => ({ open: state.open }),
    },
  ),
)
