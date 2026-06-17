import { useEffect } from 'react'
import { useChatSessionContext } from '@/context/chat-session-context'
import { useDeviceStatusStore } from '@/stores/device-status-store'

/** 将聊天 Session 连接态同步到全局设备状态 store */
export function ChatDeviceStatusBridge() {
  const { status, sseStatus, connectionError, retryConnection } = useChatSessionContext()
  const setChatState = useDeviceStatusStore(state => state.setChatState)
  const resetChatState = useDeviceStatusStore(state => state.resetChatState)
  const registerRetryHandler = useDeviceStatusStore(state => state.registerRetryHandler)

  useEffect(() => {
    setChatState({
      chatActive: true,
      chatStatus: status,
      sseStatus,
      connectionError,
    })
  }, [connectionError, setChatState, sseStatus, status])

  useEffect(() => {
    registerRetryHandler(retryConnection)
    return () => registerRetryHandler(null)
  }, [registerRetryHandler, retryConnection])

  useEffect(() => () => resetChatState(), [resetChatState])

  return null
}
