import type { SessionMeta } from '@muse-ai/shared'
import { create } from 'zustand'

interface SessionListStore {
  patches: Record<string, Partial<SessionMeta>>
  patchSession: (sessionId: string, patch: Partial<SessionMeta>) => void
  clearPatches: () => void
}

export const useSessionListStore = create<SessionListStore>(set => ({
  patches: {},
  patchSession: (sessionId, patch) => {
    set(state => ({
      patches: {
        ...state.patches,
        [sessionId]: { ...state.patches[sessionId], ...patch },
      },
    }))
  },
  clearPatches: () => set({ patches: {} }),
}))
