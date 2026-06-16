import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatRequest, SessionMeta, SessionSettingsPatch, SessionSettingsResponse, SessionTreeResponse } from '@muse-ai/shared'
import { checkCliHealth } from '@/api/backend-client'
import {
  CliApiError,
  createCliSession,
  forkSession,
  getSessionSettings,
  getSessionTree,
  listCliSessions,
  navigateSession,
  patchSessionSettings,
  postChat,
  subscribeSessionEvents,
} from '@/api/cli-client'
import { branchMessagesToChat } from '@/lib/branch-messages'
import { applySseEvent, isStreaming as checkStreaming } from '@/lib/chat-reducer'
import { createUserMessage, type ChatInputMode, type ChatMessage } from '@/lib/chat-types'
import type { StoredDeviceSession } from '@/lib/config'
import { useSessionListStore } from '@/stores/session-list-store'

export type ChatSessionStatus = 'idle' | 'connecting' | 'ready' | 'error'

interface UseChatSessionOptions {
  onSessionChange?: (sessionId: string) => void
}

function sessionStorageKey(deviceId: string): string {
  return `muse.chatSession.${deviceId}`
}

function writeStoredSessionId(deviceId: string, sessionId: string): void {
  sessionStorage.setItem(sessionStorageKey(deviceId), sessionId)
}

function startSseSubscription(
  deviceSession: StoredDeviceSession,
  sessionId: string,
  abort: AbortController,
  onEvent: (event: Parameters<typeof applySseEvent>[1]) => void,
  onError: (message: string) => void,
  onConnected?: () => void,
): Promise<void> {
  return subscribeSessionEvents(deviceSession.endpoint, deviceSession.accessToken, sessionId, onEvent, abort.signal, onConnected).catch((error: unknown) => {
    if (abort.signal.aborted) return
    onError(error instanceof Error ? error.message : String(error))
    throw error
  })
}

function resetChatState(setters: {
  setSessionId: (value: string | null) => void
  setSessionTree: (value: SessionTreeResponse | null) => void
  setSessionSettings: (value: SessionSettingsResponse | null) => void
  setMessages: (value: ChatMessage[]) => void
  setConnectionError: (value: string | null) => void
  setSendError: (value: string | null) => void
  setSettingsError: (value: string | null) => void
  setTreeError: (value: string | null) => void
}) {
  setters.setSessionId(null)
  setters.setSessionTree(null)
  setters.setSessionSettings(null)
  setters.setMessages([])
  setters.setConnectionError(null)
  setters.setSendError(null)
  setters.setSettingsError(null)
  setters.setTreeError(null)
}

export function useChatSession(deviceSession: StoredDeviceSession | null, routeSessionId: string | undefined, options?: UseChatSessionOptions) {
  const [status, setStatus] = useState<ChatSessionStatus>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [sessionTree, setSessionTree] = useState<SessionTreeResponse | null>(null)
  const [sessionSettings, setSessionSettings] = useState<SessionSettingsResponse | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)
  const sseAbortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const refreshTreeRef = useRef<(id: string) => Promise<void>>(async () => {})
  const onSessionChangeRef = useRef(options?.onSessionChange)

  useEffect(() => {
    onSessionChangeRef.current = options?.onSessionChange
  }, [options?.onSessionChange])

  const streaming = checkStreaming(messages)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadSettings = useCallback(
    async (id: string) => {
      if (!deviceSession) return null
      const settings = await getSessionSettings(deviceSession.endpoint, deviceSession.accessToken, id)
      setSessionSettings(settings)
      return settings
    },
    [deviceSession],
  )

  const refreshSessions = useCallback(async () => {
    if (!deviceSession) {
      setSessions([])
      return
    }
    setSessions(await listCliSessions(deviceSession.endpoint, deviceSession.accessToken))
  }, [deviceSession])

  const refreshTree = useCallback(
    async (id: string, replaceMessages = false) => {
      if (!deviceSession) return
      try {
        setTreeError(null)
        const tree = await getSessionTree(deviceSession.endpoint, deviceSession.accessToken, id)
        setSessionTree(tree)
        if (replaceMessages) {
          setMessages(branchMessagesToChat(tree.branch))
        }
      } catch (error: unknown) {
        setTreeError(error instanceof Error ? error.message : String(error))
      }
    },
    [deviceSession],
  )

  useEffect(() => {
    refreshTreeRef.current = async (id: string) => {
      await refreshTree(id, true)
    }
  }, [refreshTree])

  const connectSession = useCallback(
    async (id: string, connectOptions?: { resetMessages?: boolean }) => {
      if (!deviceSession) return
      sseAbortRef.current?.abort()

      setStatus('connecting')
      setConnectionError(null)
      setSendError(null)
      if (connectOptions?.resetMessages) {
        setMessages([])
      }

      writeStoredSessionId(deviceSession.deviceId, id)
      setSessionId(id)
      await loadSettings(id)
      await refreshSessions()
      await refreshTree(id, true)

      const abort = new AbortController()
      sseAbortRef.current = abort

      await new Promise<void>((resolve, reject) => {
        void startSseSubscription(
          deviceSession,
          id,
          abort,
          event => {
            if (event.type === 'session_meta_updated') {
              useSessionListStore.getState().patchSession(event.sessionId, {
                name: event.name,
                nameSource: event.nameSource,
                updatedAt: event.updatedAt,
              })
              return
            }
            setMessages(prev => applySseEvent(prev, event))
            if (event.type === 'agent_end') {
              void refreshTreeRef.current(id)
            }
          },
          message => reject(new Error(message)),
          () => resolve(),
        ).catch((error: unknown) => {
          reject(error instanceof Error ? error : new Error(String(error)))
        })
      })

      setStatus('ready')
    },
    [deviceSession, loadSettings, refreshSessions, refreshTree],
  )

  useEffect(() => {
    sseAbortRef.current?.abort()
    sseAbortRef.current = null

    let cancelled = false

    const resetToIdle = () => {
      setStatus('idle')
      resetChatState({
        setSessionId,
        setSessionTree,
        setSessionSettings,
        setMessages,
        setConnectionError,
        setSendError,
        setSettingsError,
        setTreeError,
      })
    }

    if (!deviceSession) {
      queueMicrotask(() => {
        if (cancelled) return
        resetToIdle()
      })
      return () => {
        cancelled = true
      }
    }

    if (!routeSessionId) {
      queueMicrotask(() => {
        if (cancelled) return
        resetToIdle()
        void refreshSessions()
      })
      return () => {
        cancelled = true
      }
    }

    const ds = deviceSession
    const targetSessionId = routeSessionId

    async function init() {
      try {
        const healthy = await checkCliHealth(ds.endpoint, ds.accessToken)
        if (!healthy) {
          throw new Error('cli_unreachable')
        }
        if (cancelled) return
        await connectSession(targetSessionId, { resetMessages: true })
      } catch (error: unknown) {
        if (cancelled) return
        if (error instanceof Error && error.message === 'cli_unreachable') {
          setConnectionError('cli_unreachable')
        } else if (error instanceof CliApiError) {
          setConnectionError(error.message)
        } else {
          setConnectionError(error instanceof Error ? error.message : String(error))
        }
        setStatus('error')
      }
    }

    void init()

    return () => {
      cancelled = true
      sseAbortRef.current?.abort()
      sseAbortRef.current = null
    }
  }, [deviceSession, routeSessionId, connectSession, refreshSessions])

  const sendMessage = useCallback(
    async (text: string, mode: ChatInputMode) => {
      if (!deviceSession || !sessionId || status !== 'ready') return
      const trimmed = text.trim()
      if (!trimmed) return

      setSendError(null)
      setMessages(prev => [...prev, createUserMessage(trimmed, mode)])

      try {
        const request: ChatRequest = { sessionId, message: trimmed, mode }
        await postChat(deviceSession.endpoint, deviceSession.accessToken, request)
      } catch (error: unknown) {
        setSendError(error instanceof Error ? error.message : String(error))
      }
    },
    [deviceSession, sessionId, status],
  )

  const updateSessionSettings = useCallback(
    async (patch: SessionSettingsPatch) => {
      if (!deviceSession || !sessionId) return null
      setSettingsError(null)
      try {
        const updated = await patchSessionSettings(deviceSession.endpoint, deviceSession.accessToken, sessionId, patch)
        setSessionSettings(updated)
        return updated
      } catch (error: unknown) {
        setSettingsError(error instanceof Error ? error.message : String(error))
        return null
      }
    },
    [deviceSession, sessionId],
  )

  const createSession = useCallback(
    async (agentId?: string) => {
      if (!deviceSession) return null
      try {
        const settings = sessionSettings ?? (routeSessionId ? await loadSettings(routeSessionId) : null)
        const session = await createCliSession(deviceSession.endpoint, deviceSession.accessToken, {
          agentId: agentId ?? settings?.agentId,
        })
        await refreshSessions()
        return session.id
      } catch (error: unknown) {
        setConnectionError(error instanceof Error ? error.message : String(error))
        setStatus('error')
        return null
      }
    },
    [deviceSession, loadSettings, refreshSessions, routeSessionId, sessionSettings],
  )

  const startNewSession = useCallback(async () => {
    const id = await createSession()
    if (id) {
      onSessionChangeRef.current?.(id)
    }
  }, [createSession])

  const navigateToEntry = useCallback(
    async (entryId: string | null) => {
      if (!deviceSession || !sessionId || streaming) return
      try {
        setTreeError(null)
        const tree = await navigateSession(deviceSession.endpoint, deviceSession.accessToken, sessionId, { entryId })
        setSessionTree(tree)
        setMessages(branchMessagesToChat(tree.branch))
      } catch (error: unknown) {
        setTreeError(error instanceof Error ? error.message : String(error))
      }
    },
    [deviceSession, sessionId, streaming],
  )

  const forkFromEntry = useCallback(
    async (entryId?: string) => {
      if (!deviceSession || !sessionId) return
      try {
        const forked = await forkSession(deviceSession.endpoint, deviceSession.accessToken, sessionId, { entryId })
        onSessionChangeRef.current?.(forked.id)
      } catch (error: unknown) {
        setTreeError(error instanceof Error ? error.message : String(error))
      }
    },
    [deviceSession, sessionId],
  )

  return {
    status,
    sessionId,
    sessions,
    sessionTree,
    sessionSettings,
    messages,
    streaming,
    connectionError,
    sendError,
    settingsError,
    treeError,
    sendMessage,
    updateSessionSettings,
    startNewSession,
    navigateToEntry,
    forkFromEntry,
    refreshSessions,
    messagesEndRef,
  }
}
