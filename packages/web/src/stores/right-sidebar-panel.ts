import { create } from 'zustand'
import type { RightSidebarPanelId } from '@/constants/right-sidebar-actions'

interface RightSidebarPanelState {
  activePanel: RightSidebarPanelId | null
  panelRefresh: (() => void) | null
  openPanel: (panel: RightSidebarPanelId) => void
  closePanel: () => void
  togglePanel: (panel: RightSidebarPanelId) => void
  setPanelRefresh: (refresh: (() => void) | null) => void
}

export const useRightSidebarPanelStore = create<RightSidebarPanelState>((set) => ({
  activePanel: null,
  panelRefresh: null,
  openPanel: (panel) => set({ activePanel: panel }),
  closePanel: () => set({ activePanel: null, panelRefresh: null }),
  togglePanel: (panel) =>
    set((state) => ({
      activePanel: state.activePanel === panel ? null : panel,
      panelRefresh: state.activePanel === panel ? null : state.panelRefresh,
    })),
  setPanelRefresh: (refresh) => set({ panelRefresh: refresh }),
}))
