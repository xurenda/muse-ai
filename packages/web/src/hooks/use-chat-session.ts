import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '@/utils/chat-message'
import {
  agentMessagesToChatMessages,
  applyAgentEvent,
  isAgentBusyEvent,
  isAgentIdleEvent,
  isDaemonWsMessage,
} from '@/utils/chat-message'
import {
  abortSession,
  buildSessionEventsUrl,
  createSession,
  getSession,
  sendSessionFollowUp,
  sendSessionPrompt,
  sendSessionSteer,
} from '@/services/session-api'

export type SessionMessageDelivery = 'prompt' | 'steer' | 'followUp'

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

  const handleWsPayload = useCallback((raw: string) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw) as unknown
    } catch {
      return
    }

    if (!isDaemonWsMessage(parsed)) {
      return
    }

    if (parsed.type === 'session_snapshot') {
      setMessages(agentMessagesToChatMessages(parsed.messages))
      setIsSending(parsed.isStreaming)
      return
    }

    if (parsed.type === 'session_state') {
      setIsSending(parsed.isStreaming)
      return
    }

    if (parsed.type === 'session_error') {
      setError(parsed.error)
      setIsSending(false)
      return
    }

    if (parsed.type === 'agent_event') {
      const event = parsed.event
      if (isAgentBusyEvent(event)) {
        setIsSending(true)
      }
      if (isAgentIdleEvent(event)) {
        setIsSending(false)
      }
      setMessages((current) => applyAgentEvent(current, parsed))
    }
  }, [])

  const connectEvents = useCallback(
    (id: string) => {
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
          handleWsPayload(event.data as string)
        }
      })
    },
    [handleWsPayload],
  )

  const hydrateSession = useCallback(async (id: string) => {
    const detail = await getSession(id)
    setSessionId(detail.session.id)
    setMessages(agentMessagesToChatMessages(detail.messages))
    setIsSending(detail.isStreaming)
    if (detail.session.cwd) {
      setResolvedCwd(detail.session.cwd)
    }
    return detail
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
        await hydrateSession(routeSessionId)
        await connectEvents(routeSessionId)
      } catch (resumeError) {
        const message = resumeError instanceof Error ? resumeError.message : String(resumeError)
        setError(message)
      } finally {
        setIsLoading(false)
      }
    })()
  }, [connectEvents, hydrateSession, routeSessionId])

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

  const ensureSocket = useCallback(
    async (id: string) => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        await connectEvents(id)
      }
    },
    [connectEvents],
  )

  const sendMessage = useCallback(
    async (text: string, delivery: SessionMessageDelivery = 'prompt') => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) {
        return
      }

      if (!isSending && delivery !== 'prompt') {
        return
      }

      if (!isSending && delivery === 'prompt') {
        setError(null)
      }

      try {
        const id = await ensureSession()
        await ensureSocket(id)

        if (isSending) {
          if (delivery === 'followUp') {
            await sendSessionFollowUp(id, { message: trimmed })
          } else {
            await sendSessionSteer(id, { message: trimmed })
          }
          return
        }

        await sendSessionPrompt(id, { message: trimmed })
        setIsSending(true)
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : String(sendError)
        setError(message)
      }
    },
    [ensureSession, ensureSocket, isLoading, isSending],
  )

  const stopGeneration = useCallback(async () => {
    if (!sessionId || !isSending) {
      return
    }

    setError(null)

    try {
      await abortSession(sessionId)
    } catch (abortError) {
      const message = abortError instanceof Error ? abortError.message : String(abortError)
      setError(message)
    }
  }, [isSending, sessionId])

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
    stopGeneration,
  }
}
