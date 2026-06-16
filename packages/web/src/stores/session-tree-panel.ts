import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SessionTreePanelState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useSessionTreePanelStore = create<SessionTreePanelState>()(
  persist(
    set => ({
      open: true,
      setOpen: open => set({ open }),
    }),
    { name: 'muse-ai:session-tree-panel' },
  ),
)
