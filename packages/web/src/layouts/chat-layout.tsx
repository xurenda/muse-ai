import { Outlet } from 'react-router-dom'
import { ChatDeviceStatusBridge } from '@/components/layout/chat-device-status-bridge'
import { ChatStatusBarContextPanel } from '@/components/layout/chat-status-bar-context-picker'
import { ChatStatusBarModelPicker } from '@/components/layout/chat-status-bar-model-picker'

/** 聊天路由布局：状态栏扩展与设备桥接（Session 上下文由 AppLayout 提供） */
export function ChatLayout() {
  return (
    <>
      <ChatDeviceStatusBridge />
      <ChatStatusBarContextPanel />
      <ChatStatusBarModelPicker />
      <Outlet />
    </>
  )
}
