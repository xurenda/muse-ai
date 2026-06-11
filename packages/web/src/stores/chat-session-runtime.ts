import { create } from 'zustand'

interface ChatSessionRuntimeState {
  isSending: boolean
  setIsSending: (isSending: boolean) => void
}

/** 供右侧边栏等跨组件读取当前 chat 会话的运行时状态 */
export const useChatSessionRuntimeStore = create<ChatSessionRuntimeState>((set) => ({
  isSending: false,
  setIsSending: (isSending) => set({ isSending }),
}))
