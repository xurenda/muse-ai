import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { ChatRequest, SessionSettingsPatch, SessionSettingsResponse, SessionTreeResponse } from '@muse-ai/shared'
import { addTurnToSessionUsage } from '@muse-ai/shared'
import { checkCliHealth } from '@/api/backend-client'
import {
  createCliSession,
  compactSession,
  forkSession,
  getSessionSettings,
  getSessionTree,
  navigateSession,
  patchSessionSettings,
  postChat,
  subscribeSessionEvents,
} from '@/api/cli-client'
import { branchMessagesToChat } from '@/lib/branch-messages'
import { mergeBranchWithEphemeralTail, type MergeBranchOptions } from '@/lib/merge-branch-messages'
import { applySseEvent, isStreaming as checkStreaming } from '@/lib/chat-reducer'
import { createUserMessage, isAssistantMessage, type ChatInputMode, type ChatMessage } from '@/lib/chat-types'
import { parseConnectionError, type ParsedConnectionError } from '@/lib/connection-errors'
import type { StoredDeviceSession } from '@/lib/config'
import { useDeviceHealth } from '@/hooks/use-device-health'
import { useSessionListStore } from '@/stores/session-list-store'

export type ChatSessionStatus = 'idle' | 'connecting' | 'ready' | 'error'
export type SseConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

interface UseChatSessionOptions {
  onSessionChange?: (sessionId: string) => void
}

function sessionStorageKey(deviceId: string): string {
  return `muse.chatSession.${deviceId}`
}

function writeStoredSessionId(deviceId: string, sessionId: string): void {
  sessionStorage.setItem(sessionStorageKey(deviceId), sessionId)
}

function resetChatState(setters: {
  setSessionId: (value: string | null) => void
  setSessionTree: (value: SessionTreeResponse | null) => void
  setSessionSettings: (value: SessionSettingsResponse | null) => void
  setMessages: (value: ChatMessage[]) => void
  setConnectionError: (value: ParsedConnectionError | null) => void
  setSendError: (value: string | null) => void
  setSettingsError: (value: string | null) => void
  setTreeError: (value: string | null) => void
  setSseStatus: (value: SseConnectionStatus) => void
}) {
  setters.setSessionId(null)
  setters.setSessionTree(null)
  setters.setSessionSettings(null)
  setters.setMessages([])
  setters.setConnectionError(null)
  setters.setSendError(null)
  setters.setSettingsError(null)
  setters.setTreeError(null)
  setters.setSseStatus('idle')
}

export function useChatSession(deviceSession: StoredDeviceSession | null, routeSessionId: string | undefined, options?: UseChatSessionOptions) {
  const { t } = useTranslation('chat')
  const { reachable } = useDeviceHealth()
  const [status, setStatus] = useState<ChatSessionStatus>('idle')
  const [sseStatus, setSseStatus] = useState<SseConnectionStatus>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionTree, setSessionTree] = useState<SessionTreeResponse | null>(null)
  const [sessionSettings, setSessionSettings] = useState<SessionSettingsResponse | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connectionError, setConnectionError] = useState<ParsedConnectionError | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [compacting, setCompacting] = useState(false)
  const sseAbortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const refreshTreeRef = useRef<(id: string) => Promise<void>>(async () => {})
  const onSessionChangeRef = useRef(options?.onSessionChange)
  const prevDeviceReachableRef = useRef<boolean | null>(null)
  const deviceWasUnreachableRef = useRef(false)
  const sessionAutoRetryRef = useRef(false)
  const requestSessionListRefresh = useSessionListStore(state => state.requestRefresh)

  useEffect(() => {
    onSessionChangeRef.current = options?.onSessionChange
  }, [options?.onSessionChange])

  const streaming = checkStreaming(messages)
  const deviceUnreachable = reachable === false
  const canSend = status === 'ready' && sseStatus === 'connected' && !deviceUnreachable && !compacting

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (reachable === false) {
      deviceWasUnreachableRef.current = true
    }
  }, [reachable])

  const mergeOptionsForResync = useCallback((): MergeBranchOptions => {
    return {
      interruptedToolMessage: t('turnInterruptedTool'),
      interruptedTurnMessage: t('turnInterrupted'),
    }
  }, [t])

  const shouldFinalizeStaleTail = useCallback((): boolean => {
    if (deviceWasUnreachableRef.current) return true
    const last = messagesRef.current.at(-1)
    if (!last || !isAssistantMessage(last)) return false
    return last.streaming || last.toolCalls.some(tool => tool.status === 'running')
  }, [])

  const clearDeviceUnreachableFlag = useCallback(() => {
    deviceWasUnreachableRef.current = false
  }, [])

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

  const refreshTree = useCallback(
    async (id: string, replaceMessages = false, resyncAfterDisconnect = false) => {
      if (!deviceSession) return
      try {
        setTreeError(null)
        const tree = await getSessionTree(deviceSession.endpoint, deviceSession.accessToken, id)
        setSessionTree(tree)
        if (replaceMessages) {
          setMessages(prev =>
            mergeBranchWithEphemeralTail(prev, tree.branch, {
              ...mergeOptionsForResync(),
              finalizeStaleTail: resyncAfterDisconnect,
            }),
          )
        }
      } catch (error: unknown) {
        setTreeError(error instanceof Error ? error.message : String(error))
      }
    },
    [deviceSession, mergeOptionsForResync],
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
      setSseStatus('connecting')
      setConnectionError(null)
      setSendError(null)
      if (connectOptions?.resetMessages) {
        setMessages([])
      }

      writeStoredSessionId(deviceSession.deviceId, id)
      setSessionId(id)
      await loadSettings(id)
      await refreshTree(id, true)

      const abort = new AbortController()
      sseAbortRef.current = abort

      await new Promise<void>((resolve, reject) => {
        void subscribeSessionEvents(
          deviceSession.endpoint,
          deviceSession.accessToken,
          id,
          {
            onEvent: event => {
              if (event.type === 'session_meta_updated') {
                useSessionListStore.getState().patchSession(event.sessionId, {
                  name: event.name,
                  nameSource: event.nameSource,
                  updatedAt: event.updatedAt,
                })
                return
              }
              if (event.type === 'compaction_start') {
                setCompacting(true)
                return
              }
              if (event.type === 'compaction_end') {
                setCompacting(false)
                void refreshTreeRef.current(id)
                void loadSettings(id)
                if (event.success) {
                  toast.success(t('compactSuccess', { count: event.compactionCount ?? 1 }))
                } else if (event.errorMessage) {
                  toast.error(t('compactFailed', { message: event.errorMessage }))
                }
                return
              }
              if (event.type === 'turn_end' && event.usage) {
                const turnUsage = event.usage
                setSessionSettings(prev =>
                  prev
                    ? {
                        ...prev,
                        tokenUsage: addTurnToSessionUsage(prev.tokenUsage, turnUsage),
                      }
                    : prev,
                )
              }
              setMessages(prev => applySseEvent(prev, event))
              if (event.type === 'agent_end') {
                void refreshTreeRef.current(id)
                void loadSettings(id)
              }
            },
            onConnected: () => {
              setSseStatus('connected')
              resolve()
            },
            onReconnecting: () => {
              setSseStatus('reconnecting')
            },
            onReconnected: () => {
              setSseStatus('connected')
              const finalize = shouldFinalizeStaleTail()
              void refreshTree(id, true, finalize)
              clearDeviceUnreachableFlag()
              toast.success(t('sseReconnected'))
            },
          },
          abort.signal,
        ).catch((error: unknown) => {
          if (abort.signal.aborted) return
          reject(error instanceof Error ? error : new Error(String(error)))
        })
      })

      setStatus('ready')
    },
    [deviceSession, loadSettings, refreshTree, t, shouldFinalizeStaleTail, clearDeviceUnreachableFlag],
  )

  const retryConnection = useCallback(async () => {
    if (!deviceSession || !routeSessionId) return

    setConnectionError(null)
    setStatus('connecting')
    setSseStatus('connecting')

    try {
      const healthy = await checkCliHealth(deviceSession.endpoint, deviceSession.accessToken)
      if (!healthy) {
        throw new Error('cli_unreachable')
      }
      await connectSession(routeSessionId, { resetMessages: false })
    } catch (error: unknown) {
      setConnectionError(parseConnectionError(error))
      setStatus('error')
      setSseStatus('disconnected')
    }
  }, [connectSession, deviceSession, routeSessionId])

  useEffect(() => {
    if (reachable === null) return

    const prev = prevDeviceReachableRef.current
    prevDeviceReachableRef.current = reachable

    if (prev === false && reachable && status === 'error' && routeSessionId) {
      sessionAutoRetryRef.current = false
      void retryConnection()
      return
    }

    if (prev === false && reachable && status === 'ready' && sessionId) {
      void refreshTree(sessionId, true, true)
      clearDeviceUnreachableFlag()
      toast.success(t('cliHealthRestored'))
    }
  }, [reachable, refreshTree, retryConnection, routeSessionId, sessionId, status, t, clearDeviceUnreachableFlag])

  useEffect(() => {
    if (status !== 'error') {
      sessionAutoRetryRef.current = false
      return
    }
    if (reachable !== true || !routeSessionId || sessionAutoRetryRef.current) return

    sessionAutoRetryRef.current = true
    const timer = window.setTimeout(() => {
      void retryConnection()
    }, 800)
    return () => window.clearTimeout(timer)
  }, [reachable, retryConnection, routeSessionId, status])

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
        setSseStatus,
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
        requestSessionListRefresh()
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
        setConnectionError(parseConnectionError(error))
        setStatus('error')
        setSseStatus('disconnected')
      }
    }

    void init()

    return () => {
      cancelled = true
      sseAbortRef.current?.abort()
      sseAbortRef.current = null
    }
  }, [deviceSession, routeSessionId, connectSession, requestSessionListRefresh])

  const sendMessage = useCallback(
    async (text: string, mode: ChatInputMode) => {
      if (!deviceSession || !sessionId || !canSend) return
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
    [canSend, deviceSession, sessionId],
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
        requestSessionListRefresh()
        return session.id
      } catch (error: unknown) {
        setConnectionError(parseConnectionError(error))
        setStatus('error')
        setSseStatus('disconnected')
        return null
      }
    },
    [deviceSession, loadSettings, requestSessionListRefresh, routeSessionId, sessionSettings],
  )

  const startNewSession = useCallback(async () => {
    const id = await createSession()
    if (id) {
      onSessionChangeRef.current?.(id)
    }
  }, [createSession])

  const compactContext = useCallback(async () => {
    if (!deviceSession || !sessionId || compacting) return false
    setSendError(null)
    try {
      await compactSession(deviceSession.endpoint, deviceSession.accessToken, sessionId)
      return true
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      setSendError(message)
      toast.error(t('compactFailed', { message }))
      return false
    }
  }, [compacting, deviceSession, sessionId, t])

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
    sseStatus,
    sessionId,
    sessionTree,
    sessionSettings,
    messages,
    streaming,
    canSend,
    deviceUnreachable,
    connectionError,
    sendError,
    settingsError,
    treeError,
    compacting,
    sendMessage,
    compactContext,
    updateSessionSettings,
    startNewSession,
    navigateToEntry,
    forkFromEntry,
    retryConnection,
    messagesEndRef,
  }
}
