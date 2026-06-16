import { createContext, useContext, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useChatSession } from '@/hooks/use-chat-session'

type ChatSessionContextValue = ReturnType<typeof useChatSession>

const ChatSessionContext = createContext<ChatSessionContextValue | null>(null)

export function ChatSessionProvider({ children }: { children: ReactNode }) {
  const { sessionId: routeSessionId } = useParams()
  const navigate = useNavigate()
  const { deviceSession } = useAuth()

  const value = useChatSession(deviceSession, routeSessionId, {
    onSessionChange: id => {
      navigate(`/chat/${id}`)
    },
  })

  return <ChatSessionContext.Provider value={value}>{children}</ChatSessionContext.Provider>
}

export function useChatSessionContext(): ChatSessionContextValue {
  const ctx = useContext(ChatSessionContext)
  if (!ctx) {
    throw new Error('useChatSessionContext 必须在 ChatSessionProvider 内使用')
  }
  return ctx
}
