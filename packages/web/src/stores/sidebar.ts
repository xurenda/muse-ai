import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clampSidebarWidth, SIDEBAR_DEFAULT_WIDTH } from '@/constants/sidebar-layout'

interface SidebarState {
  open: boolean
  width: number
  setOpen: (open: boolean) => void
  setWidth: (width: number) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    set => ({
      open: true,
      width: SIDEBAR_DEFAULT_WIDTH,
      setOpen: open => set({ open }),
      setWidth: width => set({ width: clampSidebarWidth(width) }),
    }),
    {
      name: 'muse.sidebar',
      partialize: state => ({
        open: state.open,
        width: state.width,
      }),
      onRehydrateStorage: () => state => {
        if (state) {
          state.width = clampSidebarWidth(state.width)
        }
      },
    },
  ),
)
