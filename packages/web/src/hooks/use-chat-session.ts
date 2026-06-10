import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@/utils/chat-message'
import { applyAgentEvent } from '@/utils/chat-message'
import {
  buildSessionEventsUrl,
  createSession,
  sendSessionPrompt,
} from '@/services/session-api'

interface UseChatSessionOptions {
  agentId?: string
  cwd?: string
}

export function useChatSession(options: UseChatSessionOptions = {}) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)

  const connectEvents = useCallback((id: string) => {
    socketRef.current?.close()

    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(buildSessionEventsUrl(id))
      socketRef.current = socket

      socket.onopen = () => {
        resolve()
      }

      socket.onerror = () => {
        reject(new Error('WebSocket 连接失败'))
      }

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data as string) as {
          type: string
          sessionId: string
          event: Record<string, unknown>
        }
        if (payload.type !== 'agent_event') {
          return
        }
        setMessages((current) => applyAgentEvent(current, payload))
      }
    })
  }, [])

  const ensureSession = useCallback(async () => {
    if (sessionId) {
      return sessionId
    }

    const response = await createSession({
      agentId: options.agentId,
      cwd: options.cwd,
    })
    setSessionId(response.session.id)
    await connectEvents(response.session.id)
    return response.session.id
  }, [connectEvents, options.agentId, options.cwd, sessionId])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isSending) {
        return
      }

      setError(null)
      setIsSending(true)
      setMessages((current) => [
        ...current,
        { id: `user-${current.length}`, role: 'user', content: trimmed },
      ])

      try {
        const id = await ensureSession()
        if (socketRef.current?.readyState !== WebSocket.OPEN) {
          await connectEvents(id)
        }
        await sendSessionPrompt(id, { message: trimmed })
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : String(sendError)
        setError(message)
      } finally {
        setIsSending(false)
      }
    },
    [connectEvents, ensureSession, isSending],
  )

  useEffect(() => {
    return () => {
      socketRef.current?.close()
    }
  }, [])

  return {
    sessionId,
    messages,
    isSending,
    error,
    sendMessage,
  }
}
