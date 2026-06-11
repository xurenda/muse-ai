import { create } from 'zustand'

interface RightSidebarState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useRightSidebarStore = create<RightSidebarState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
