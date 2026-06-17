import { create } from 'zustand'
import type { ChatSessionStatus, SseConnectionStatus } from '@/hooks/use-chat-session'
import type { ParsedConnectionError } from '@/lib/connection-errors'

const MAX_ACTIVITIES = 20

export interface DeviceStatusActivity {
  id: string
  at: number
  messageKey: string
  messageParams?: Record<string, string>
}

interface ChatStatePatch {
  chatActive?: boolean
  chatStatus?: ChatSessionStatus
  sseStatus?: SseConnectionStatus
  connectionError?: ParsedConnectionError | null
}

interface DeviceStatusStore {
  deviceName: string | null
  deviceEndpoint: string | null
  hasDevice: boolean
  healthReachable: boolean | null
  healthChecking: boolean
  chatActive: boolean
  chatStatus: ChatSessionStatus
  sseStatus: SseConnectionStatus
  connectionError: ParsedConnectionError | null
  panelOpen: boolean
  panelOpenedByUser: boolean
  retryInProgress: boolean
  activities: DeviceStatusActivity[]
  retryHandler: (() => Promise<void>) | null
  setDeviceInfo: (info: { hasDevice: boolean; deviceName: string | null; deviceEndpoint: string | null }) => void
  setHealth: (reachable: boolean | null, checking: boolean) => void
  setChatState: (patch: ChatStatePatch) => void
  resetChatState: () => void
  registerRetryHandler: (handler: (() => Promise<void>) | null) => void
  openPanel: (byUser?: boolean) => void
  closePanel: () => void
  togglePanel: () => void
  pushActivity: (messageKey: string, messageParams?: Record<string, string>) => void
  invokeRetry: () => Promise<void>
}

let activityCounter = 0

export const useDeviceStatusStore = create<DeviceStatusStore>((set, get) => ({
  deviceName: null,
  deviceEndpoint: null,
  hasDevice: false,
  healthReachable: null,
  healthChecking: false,
  chatActive: false,
  chatStatus: 'idle',
  sseStatus: 'idle',
  connectionError: null,
  panelOpen: false,
  panelOpenedByUser: false,
  retryInProgress: false,
  activities: [],
  retryHandler: null,

  setDeviceInfo: info => set(info),

  setHealth: (reachable, checking) => set({ healthReachable: reachable, healthChecking: checking }),

  setChatState: patch => set(patch),

  resetChatState: () =>
    set({
      chatActive: false,
      chatStatus: 'idle',
      sseStatus: 'idle',
      connectionError: null,
    }),

  registerRetryHandler: handler => set({ retryHandler: handler }),

  openPanel: (byUser = false) =>
    set({
      panelOpen: true,
      panelOpenedByUser: byUser ? true : get().panelOpenedByUser,
    }),

  closePanel: () => set({ panelOpen: false, panelOpenedByUser: false }),

  togglePanel: () => {
    const { panelOpen } = get()
    if (panelOpen) {
      get().closePanel()
    } else {
      get().openPanel(true)
    }
  },

  pushActivity: (messageKey, messageParams) => {
    activityCounter += 1
    const entry: DeviceStatusActivity = {
      id: `activity-${activityCounter}`,
      at: Date.now(),
      messageKey,
      messageParams,
    }
    set(state => ({
      activities: [entry, ...state.activities].slice(0, MAX_ACTIVITIES),
    }))
  },

  invokeRetry: async () => {
    const { retryHandler } = get()
    if (!retryHandler) return
    set({ retryInProgress: true })
    try {
      await retryHandler()
    } finally {
      set({ retryInProgress: false })
    }
  },
}))
