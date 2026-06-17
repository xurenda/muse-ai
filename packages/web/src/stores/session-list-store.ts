import type { SessionMeta } from '@muse-ai/shared'
import { create } from 'zustand'

interface SessionListStore {
  patches: Record<string, Partial<SessionMeta>>
  /** 递增以通知侧栏重新拉取列表 */
  refreshNonce: number
  patchSession: (sessionId: string, patch: Partial<SessionMeta>) => void
  clearPatches: () => void
  requestRefresh: () => void
}

export const useSessionListStore = create<SessionListStore>(set => ({
  patches: {},
  refreshNonce: 0,
  patchSession: (sessionId, patch) => {
    set(state => ({
      patches: {
        ...state.patches,
        [sessionId]: { ...state.patches[sessionId], ...patch },
      },
    }))
  },
  clearPatches: () => set({ patches: {} }),
  requestRefresh: () => set(state => ({ refreshNonce: state.refreshNonce + 1 })),
}))
