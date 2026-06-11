import { create } from 'zustand'

interface RightSidebarState {
  open: boolean
  expandRequestId: number
  setOpen: (open: boolean) => void
  requestExpand: () => void
}

export const useRightSidebarStore = create<RightSidebarState>((set) => ({
  open: false,
  expandRequestId: 0,
  setOpen: (open) => set({ open }),
  requestExpand: () =>
    set((state) => ({
      open: true,
      expandRequestId: state.expandRequestId + 1,
    })),
}))
