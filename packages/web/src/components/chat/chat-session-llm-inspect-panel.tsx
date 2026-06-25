import { useAuth } from '@/hooks/use-auth'
import { useChatSessionContext } from '@/context/chat-session-context'
import { LlmInspectPanel } from '@/components/chat/llm-inspect-panel'

export function ChatSessionLlmInspectPanel() {
  const { deviceSession } = useAuth()
  const { sessionId, streaming } = useChatSessionContext()

  if (!sessionId || !deviceSession) {
    return null
  }

  return <LlmInspectPanel endpoint={deviceSession.endpoint} accessToken={deviceSession.accessToken} sessionId={sessionId} isStreaming={streaming} />
}
