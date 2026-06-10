import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@/utils/chat-message'
import { agentMessagesToChatMessages, applyAgentEvent } from '@/utils/chat-message'
import {
  buildSessionEventsUrl,
  createSession,
  getSession,
  sendSessionPrompt,
} from '@/services/session-api'

interface UseChatSessionOptions {
  agentId?: string
  cwd?: string
  /** 路由中的 sessionId，有值时恢复已有会话 */
  sessionId?: string
  onSessionCreated?: (sessionId: string) => void
}

export function useChatSession(options: UseChatSessionOptions = {}) {
  const { agentId, cwd, sessionId: routeSessionId, onSessionCreated } = options
  const [sessionId, setSessionId] = useState<string | null>(routeSessionId ?? null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [resolvedCwd, setResolvedCwd] = useState(cwd ?? '')
  const [isLoading, setIsLoading] = useState(Boolean(routeSessionId))
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const resumedRef = useRef(false)

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
          type: 'agent_event'
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

  useEffect(() => {
    if (!routeSessionId || resumedRef.current) {
      return
    }

    resumedRef.current = true
    setIsLoading(true)
    setError(null)

    void (async () => {
      try {
        const detail = await getSession(routeSessionId)
        setSessionId(detail.session.id)
        setMessages(agentMessagesToChatMessages(detail.messages))
        if (detail.session.cwd) {
          setResolvedCwd(detail.session.cwd)
        }
        await connectEvents(detail.session.id)
      } catch (resumeError) {
        const message = resumeError instanceof Error ? resumeError.message : String(resumeError)
        setError(message)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [connectEvents, routeSessionId])

  useEffect(() => {
    if (!routeSessionId) {
      setResolvedCwd(cwd ?? '')
    }
  }, [cwd, routeSessionId])

  const ensureSession = useCallback(async () => {
    if (sessionId) {
      return sessionId
    }

    const response = await createSession({
      agentId,
      cwd: cwd?.trim() || undefined,
    })
    setSessionId(response.session.id)
    if (response.session.cwd) {
      setResolvedCwd(response.session.cwd)
    }
    onSessionCreated?.(response.session.id)
    await connectEvents(response.session.id)
    return response.session.id
  }, [agentId, connectEvents, cwd, onSessionCreated, sessionId])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isSending || isLoading) {
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
    [connectEvents, ensureSession, isLoading, isSending],
  )

  useEffect(() => {
    return () => {
      socketRef.current?.close()
    }
  }, [])

  return {
    sessionId,
    messages,
    resolvedCwd,
    isLoading,
    isSending,
    error,
    sendMessage,
  }
}
