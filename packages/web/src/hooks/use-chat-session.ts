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

export type ChatSessionStatus = 'connecting' | 'ready' | 'error'

function sessionStorageKey(deviceId: string): string {
  return `muse.chatSession.${deviceId}`
}

function readStoredSessionId(deviceId: string): string | null {
  return sessionStorage.getItem(sessionStorageKey(deviceId))
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

export function useChatSession(deviceSession: StoredDeviceSession | null) {
  const [status, setStatus] = useState<ChatSessionStatus>('connecting')
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
    if (!deviceSession) return
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
    async (id: string, options?: { resetMessages?: boolean }) => {
      if (!deviceSession) return
      sseAbortRef.current?.abort()

      setStatus('connecting')
      setConnectionError(null)
      setSendError(null)
      if (options?.resetMessages) {
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
    if (!deviceSession) return undefined

    const ds = deviceSession
    let cancelled = false
    const abort = new AbortController()

    async function init() {
      try {
        const healthy = await checkCliHealth(ds.endpoint, ds.accessToken)
        if (!healthy) {
          throw new Error('cli_unreachable')
        }

        let id = readStoredSessionId(ds.deviceId)
        if (!id) {
          const session = await createCliSession(ds.endpoint, ds.accessToken, {})
          id = session.id
        }

        if (cancelled) return
        await connectSession(id, { resetMessages: true })
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
      abort.abort()
      sseAbortRef.current?.abort()
      sseAbortRef.current = null
    }
  }, [deviceSession, connectSession])

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

  const selectSession = useCallback(
    async (id: string) => {
      if (!deviceSession || id === sessionId) return
      try {
        await connectSession(id, { resetMessages: true })
      } catch (error: unknown) {
        setConnectionError(error instanceof Error ? error.message : String(error))
        setStatus('error')
      }
    },
    [connectSession, deviceSession, sessionId],
  )

  const newSession = useCallback(
    async (agentId?: string) => {
      if (!deviceSession) return
      try {
        const session = await createCliSession(deviceSession.endpoint, deviceSession.accessToken, {
          agentId: agentId ?? sessionSettings?.agentId,
        })
        await connectSession(session.id, { resetMessages: true })
      } catch (error: unknown) {
        setConnectionError(error instanceof Error ? error.message : String(error))
        setStatus('error')
      }
    },
    [connectSession, deviceSession, sessionSettings],
  )

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
        await connectSession(forked.id, { resetMessages: true })
      } catch (error: unknown) {
        setTreeError(error instanceof Error ? error.message : String(error))
      }
    },
    [connectSession, deviceSession, sessionId],
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
    selectSession,
    newSession,
    navigateToEntry,
    forkFromEntry,
    refreshSessions,
    messagesEndRef,
  }
}
