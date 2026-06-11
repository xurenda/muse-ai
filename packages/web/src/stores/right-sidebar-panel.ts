import { create } from 'zustand'
import type { RightSidebarPanelId } from '@/constants/right-sidebar-actions'

interface RightSidebarPanelState {
  activePanel: RightSidebarPanelId | null
  openPanel: (panel: RightSidebarPanelId) => void
  closePanel: () => void
  togglePanel: (panel: RightSidebarPanelId) => void
}

export const useRightSidebarPanelStore = create<RightSidebarPanelState>((set) => ({
  activePanel: null,
  openPanel: (panel) => set({ activePanel: panel }),
  closePanel: () => set({ activePanel: null }),
  togglePanel: (panel) =>
    set((state) => ({
      activePanel: state.activePanel === panel ? null : panel,
    })),
}))
