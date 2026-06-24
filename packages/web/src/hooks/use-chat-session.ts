import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { ChatRequest, SessionSettingsPatch, SessionSettingsResponse, SessionTreeResponse, TurnTokenUsage } from '@muse-ai/shared'
import { addTurnToSessionUsage } from '@muse-ai/shared'
import { checkCliHealth } from '@/api/backend-client'
import {
  createCliSession,
  compactSession,
  forkSession,
  abortSession,
  getSessionSettings,
  getSessionTree,
  navigateSession,
  patchSessionSettings,
  postChat,
  subscribeSessionEvents,
} from '@/api/cli-client'
import { fetchModelStrategy } from '@/api/settings-api'
import type { ModelSelection } from '@muse-ai/shared'
import { buildModelCatalog, resolveModelLabel, resolveModelContextWindow, resolveOptimisticModelRef, type ModelCatalogItem } from '@/utils/model-strategy-ui'
import { branchMessagesToChat } from '@/lib/branch-messages'
import { hasRunningTool } from '@/lib/assistant-message-helpers'
import { mergeBranchWithEphemeralTail, type MergeBranchOptions } from '@/lib/merge-branch-messages'
import { applySseEvent, finalizeStoppedAssistantTail, isStreaming as checkStreaming, type ApplySseEventOptions } from '@/lib/chat-reducer'
import { createUserMessage, isAssistantMessage, type ChatInputMode, type ChatMessage } from '@/lib/chat-types'
import { computeStreamingTurnTokenDisplay, estimateAssistantContentChars, mergeTurnUsageWithContentEstimate } from '@/lib/estimate-streaming-turn-tokens'
import { parseConnectionError, type ParsedConnectionError } from '@/lib/connection-errors'
import type { StoredDeviceSession } from '@/lib/config'
import { useDeviceHealth } from '@/hooks/use-device-health'
import { useSessionListStore } from '@/stores/session-list-store'

export type ChatSessionStatus = 'idle' | 'connecting' | 'ready' | 'error'
export type SseConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

/** 对话模型 Picker 展示：SSE model_resolved（chat）驱动 */
export interface ChatModelResolvedDisplay {
  resolvedModelRef: string | null
}

const INITIAL_CHAT_MODEL_DISPLAY: ChatModelResolvedDisplay = {
  resolvedModelRef: null,
}

interface UseChatSessionOptions {
  onSessionChange?: (sessionId: string) => void
  /** 返回当前有效的 access token（必要时自动刷新） */
  getValidAccessToken?: () => Promise<string>
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
  setChatModelDisplay: (value: ChatModelResolvedDisplay) => void
  setChatContextWindow: (value: number | null) => void
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
  setters.setChatModelDisplay(INITIAL_CHAT_MODEL_DISPLAY)
  setters.setChatContextWindow(null)
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
  const [stopping, setStopping] = useState(false)
  const [chatModelDisplay, setChatModelDisplay] = useState<ChatModelResolvedDisplay>(INITIAL_CHAT_MODEL_DISPLAY)
  const [chatContextWindow, setChatContextWindow] = useState<number | null>(null)
  // streaming 期间累计的真实 token 用量（turn_end 逐轮累加）
  const [streamingTurnUsage, setStreamingTurnUsage] = useState<TurnTokenUsage | null>(null)
  const streamingTurnUsageRef = useRef<TurnTokenUsage | null>(null)
  /** 上一次 turn_end 时 assistant 内容字符数，用于估算当前 turn 增量 */
  const [lastTurnEndContentChars, setLastTurnEndContentChars] = useState(0)
  const lastTurnEndContentCharsRef = useRef(0)
  const syncLastTurnEndContentChars = useCallback((chars: number) => {
    lastTurnEndContentCharsRef.current = chars
    setLastTurnEndContentChars(chars)
  }, [])
  // agent 开始时间戳（用于实时计算 elapsed）
  const agentStartedAtRef = useRef<number | null>(null)
  const [agentStartedAt, setAgentStartedAt] = useState<number | null>(null)
  const modelStrategyPoolsRef = useRef<{ high: string[]; medium: string[]; low: string[] } | null>(null)
  const lastModelResolvedDedupRef = useRef<string | null>(null)
  const sseAbortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef<ChatMessage[]>([])
  const sessionTreeRef = useRef<SessionTreeResponse | null>(null)
  const refreshTreeRef = useRef<(id: string) => Promise<void>>(async () => {})
  const onSessionChangeRef = useRef(options?.onSessionChange)
  const prevDeviceReachableRef = useRef<boolean | null>(null)
  const deviceWasUnreachableRef = useRef(false)
  const sessionAutoRetryRef = useRef(false)
  const requestSessionListRefresh = useSessionListStore(state => state.requestRefresh)
  const modelCatalogRef = useRef<ModelCatalogItem[]>([])
  const getValidAccessToken = options?.getValidAccessToken

  const resolveModelDisplayName = useCallback((modelRef: string): string => {
    return resolveModelLabel(modelRef, modelCatalogRef.current)
  }, [])

  const showModelFallbackToast = useCallback(
    (failedModelRef: string, resolvedModelRef: string) => {
      toast.info(
        t('modelPicker.fallbackToast', {
          fromModelName: resolveModelDisplayName(failedModelRef),
          toModelName: resolveModelDisplayName(resolvedModelRef),
        }),
      )
    },
    [resolveModelDisplayName, t],
  )

  useEffect(() => {
    if (!getValidAccessToken) return

    let cancelled = false
    void getValidAccessToken()
      .then(token => fetchModelStrategy(token))
      .then(response => {
        if (cancelled) return
        const configured = response.options.filter(option => option.authStatus === 'configured')
        modelCatalogRef.current = buildModelCatalog(configured)
        modelStrategyPoolsRef.current = response.strategy.pools
      })
      .catch(() => {
        if (!cancelled) {
          modelCatalogRef.current = []
          modelStrategyPoolsRef.current = null
        }
      })

    return () => {
      cancelled = true
    }
  }, [getValidAccessToken])

  useEffect(() => {
    onSessionChangeRef.current = options?.onSessionChange
  }, [options?.onSessionChange])

  const streaming = checkStreaming(messages)
  const streamingTurnTokenDisplay = useMemo(() => {
    if (!streaming) return null
    const last = messages.at(-1)
    const currentChars = last && isAssistantMessage(last) ? estimateAssistantContentChars(last.blocks) : 0
    const confirmed = streamingTurnUsage?.total ?? 0
    return computeStreamingTurnTokenDisplay(confirmed, currentChars, lastTurnEndContentChars)
  }, [streaming, streamingTurnUsage, messages, lastTurnEndContentChars])
  const deviceUnreachable = reachable === false
  const sessionReady = status === 'ready' && sseStatus === 'connected' && !deviceUnreachable
  const canSend = sessionReady && !compacting
  const canStop = (streaming || compacting) && sessionReady && !stopping

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

  const sseEventOptions = useMemo(
    (): ApplySseEventOptions => ({
      stoppedToolMessage: t('toolStopped'),
    }),
    [t],
  )

  const shouldFinalizeStaleTail = useCallback((): boolean => {
    if (deviceWasUnreachableRef.current) return true
    const last = messagesRef.current.at(-1)
    if (!last || !isAssistantMessage(last)) return false
    return last.streaming || hasRunningTool(last)
  }, [])

  const clearDeviceUnreachableFlag = useCallback(() => {
    deviceWasUnreachableRef.current = false
  }, [])

  const syncChatContextWindow = useCallback((settings: SessionSettingsResponse | null, resolvedModelRef?: string | null) => {
    const fromSettings = settings?.contextUsage?.contextWindow
    if (fromSettings !== null && fromSettings !== undefined && fromSettings > 0) {
      setChatContextWindow(fromSettings)
      return
    }
    const modelRef = resolvedModelRef ?? settings?.modelRef
    if (modelRef) {
      const fromCatalog = resolveModelContextWindow(modelRef, modelCatalogRef.current)
      if (fromCatalog !== null) {
        setChatContextWindow(fromCatalog)
        return
      }
    }
    const pools = modelStrategyPoolsRef.current
    const optimisticRef = resolveOptimisticModelRef(settings?.modelSelection, pools ?? { high: [], medium: [], low: [] }, modelCatalogRef.current)
    if (optimisticRef) {
      const fromOptimistic = resolveModelContextWindow(optimisticRef, modelCatalogRef.current)
      setChatContextWindow(fromOptimistic)
      return
    }
    setChatContextWindow(null)
  }, [])

  const loadSettings = useCallback(
    async (id: string) => {
      if (!deviceSession) return null
      const settings = await getSessionSettings(deviceSession.endpoint, deviceSession.accessToken, id)
      setSessionSettings(settings)
      syncChatContextWindow(settings, settings?.modelRef)
      return settings
    },
    [deviceSession, syncChatContextWindow],
  )

  const refreshTree = useCallback(
    async (id: string, replaceMessages = false, resyncAfterDisconnect = false) => {
      if (!deviceSession) return
      try {
        setTreeError(null)
        const tree = await getSessionTree(deviceSession.endpoint, deviceSession.accessToken, id)
        setSessionTree(tree)
        sessionTreeRef.current = tree
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
      setChatModelDisplay(INITIAL_CHAT_MODEL_DISPLAY)
      setChatContextWindow(null)
      lastModelResolvedDedupRef.current = null
      if (connectOptions?.resetMessages) {
        setMessages([])
      }

      writeStoredSessionId(deviceSession.deviceId, id)
      setSessionId(id)
      const settings = await loadSettings(id)
      if (settings?.modelRef) {
        setChatModelDisplay({ resolvedModelRef: settings.modelRef })
      }
      syncChatContextWindow(settings, settings?.modelRef)
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
              if (event.type === 'agent_start') {
                const now = Date.now()
                agentStartedAtRef.current = now
                setAgentStartedAt(now)
                setStreamingTurnUsage(null)
                streamingTurnUsageRef.current = null
                syncLastTurnEndContentChars(0)
                setMessages(prev => applySseEvent(prev, event, sseEventOptions))
                return
              }
              if (event.type === 'turn_start') {
                lastModelResolvedDedupRef.current = null
                return
              }
              if (event.type === 'model_resolved') {
                if (event.task !== 'chat') return
                const dedupKey = `${event.modelRef}|${event.usedFallback === true}|${event.attemptedModelRefs?.join(',') ?? ''}`
                if (lastModelResolvedDedupRef.current === dedupKey) return
                lastModelResolvedDedupRef.current = dedupKey
                setChatModelDisplay({
                  resolvedModelRef: event.modelRef,
                })
                if (event.contextWindow !== undefined && event.contextWindow > 0) {
                  setChatContextWindow(event.contextWindow)
                }
                if (event.usedFallback === true) {
                  const failedModelRef = event.attemptedModelRefs?.[0]
                  if (failedModelRef && failedModelRef !== event.modelRef) {
                    showModelFallbackToast(failedModelRef, event.modelRef)
                  }
                }
                return
              }
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
                setStopping(false)
                void refreshTreeRef.current(id)
                void loadSettings(id)
                if (event.success) {
                  toast.success(t('compactSuccess', { count: event.compactionCount ?? 1 }))
                } else if (!event.cancelled && event.errorMessage) {
                  toast.error(t('compactFailed', { message: event.errorMessage }))
                }
                return
              }
              if (event.type === 'turn_end') {
                if (event.usage) {
                  const turnUsage = event.usage
                  setSessionSettings(prev =>
                    prev
                      ? {
                          ...prev,
                          tokenUsage: addTurnToSessionUsage(prev.tokenUsage, turnUsage),
                        }
                      : prev,
                  )
                  // 累加到 streaming 实时用量
                  setStreamingTurnUsage(prev => {
                    const next = prev
                      ? {
                          ...prev,
                          input: prev.input + turnUsage.input,
                          output: prev.output + turnUsage.output,
                          total: prev.total + turnUsage.total,
                          cacheRead: (prev.cacheRead ?? 0) + (turnUsage.cacheRead ?? 0),
                          cacheWrite: (prev.cacheWrite ?? 0) + (turnUsage.cacheWrite ?? 0),
                        }
                      : turnUsage
                    streamingTurnUsageRef.current = next
                    return next
                  })
                }
                if (event.contextUsage) {
                  setSessionSettings(prev => (prev ? { ...prev, contextUsage: event.contextUsage! } : prev))
                  if (event.contextUsage.contextWindow !== null && event.contextUsage.contextWindow !== undefined) {
                    setChatContextWindow(event.contextUsage.contextWindow)
                  }
                }
                const lastAssistant = messagesRef.current.at(-1)
                if (lastAssistant && isAssistantMessage(lastAssistant)) {
                  syncLastTurnEndContentChars(estimateAssistantContentChars(lastAssistant.blocks))
                }
              }
              if (event.type === 'agent_end') {
                const durationMs = agentStartedAtRef.current !== null ? Date.now() - agentStartedAtRef.current : undefined
                const lastAssistant = messagesRef.current.at(-1)
                const currentChars = lastAssistant && isAssistantMessage(lastAssistant) ? estimateAssistantContentChars(lastAssistant.blocks) : 0
                const finalUsage = mergeTurnUsageWithContentEstimate(streamingTurnUsageRef.current, currentChars, lastTurnEndContentCharsRef.current)
                setMessages(prev => applySseEvent(prev, event, { ...sseEventOptions, turnUsage: finalUsage, durationMs }))
                setStreamingTurnUsage(null)
                streamingTurnUsageRef.current = null
                syncLastTurnEndContentChars(0)
                agentStartedAtRef.current = null
                setAgentStartedAt(null)
                setStopping(false)
                void refreshTreeRef.current(id)
                void loadSettings(id)
                return
              }
              setMessages(prev => applySseEvent(prev, event, sseEventOptions))
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
    [
      deviceSession,
      loadSettings,
      refreshTree,
      showModelFallbackToast,
      sseEventOptions,
      syncChatContextWindow,
      t,
      shouldFinalizeStaleTail,
      clearDeviceUnreachableFlag,
    ],
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
        setChatModelDisplay,
        setChatContextWindow,
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

  /**
   * 重新生成：navigate 到该 user 消息所在轮次之前（即前一条 assistant 的 entryId），
   * 然后直接 postChat 重发。
   * 编辑：同样 navigate，但不发送（由调用方在回填输入框后手动发送）。
   *
   * navigateEntryId：该 user 消息节点的 parentId（在 sessionTree.entries 里查），
   * 即前一条 assistant 节点 id，或 null（第一条消息）。
   */
  const retryFromMessage = useCallback(
    async (userMessageId: string, sendAfter?: string) => {
      if (!deviceSession || !sessionId) return

      // 从 sessionTree.entries 找到该 user 消息的 parentId
      // 如果 sessionTree 中没有（刚发的还未写入树），先刷新
      let entries = sessionTreeRef.current?.entries ?? []
      let userEntry = entries.find(e => e.id === userMessageId && e.type === 'message' && e.role === 'user')

      if (!userEntry) {
        // 尝试刷新树
        try {
          const latestTree = await getSessionTree(deviceSession.endpoint, deviceSession.accessToken, sessionId)
          setSessionTree(latestTree)
          sessionTreeRef.current = latestTree
          entries = latestTree.entries
          userEntry = entries.find(e => e.id === userMessageId && e.type === 'message' && e.role === 'user')
        } catch {
          // 忽略，继续尝试
        }
      }

      // parentId 是该 user 消息在树里的父节点（前一条 assistant）
      const parentEntryId = userEntry?.parentId ?? null

      // 内联 navigate 逻辑（与 navigateToEntry 一致），避免声明顺序依赖
      try {
        setTreeError(null)
        const tree = await navigateSession(deviceSession.endpoint, deviceSession.accessToken, sessionId, { entryId: parentEntryId })
        setSessionTree(tree)
        sessionTreeRef.current = tree
        setMessages(branchMessagesToChat(tree.branch))
      } catch (navError: unknown) {
        setSendError(navError instanceof Error ? navError.message : String(navError))
        return
      }

      if (sendAfter !== undefined) {
        // 重新生成：直接发送
        const text = sendAfter.trim()
        if (!text || !sessionId) return
        setSendError(null)
        setMessages(prev => [...prev, createUserMessage(text, 'prompt')])
        try {
          const request: ChatRequest = { sessionId, message: text, mode: 'prompt' }
          await postChat(deviceSession.endpoint, deviceSession.accessToken, request)
        } catch (error: unknown) {
          setSendError(error instanceof Error ? error.message : String(error))
        }
      }
    },
    [deviceSession, sessionId],
  )

  // 保持 messagesRef 与 messages 同步，以便在 callback 中读取最新值
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const stopGeneration = useCallback(async () => {
    if (!deviceSession || !sessionId || !canStop) return
    setSendError(null)
    setStopping(true)
    if (streaming) {
      const durationMs = agentStartedAtRef.current !== null ? Date.now() - agentStartedAtRef.current : undefined
      const lastAssistant = messagesRef.current.at(-1)
      const currentChars = lastAssistant && isAssistantMessage(lastAssistant) ? estimateAssistantContentChars(lastAssistant.blocks) : 0
      const turnUsage = mergeTurnUsageWithContentEstimate(streamingTurnUsageRef.current, currentChars, lastTurnEndContentCharsRef.current)
      setMessages(prev => finalizeStoppedAssistantTail(prev, t('toolStopped'), { turnUsage, durationMs }))
    }
    try {
      const result = await abortSession(deviceSession.endpoint, deviceSession.accessToken, sessionId)
      if (!result.aborted) {
        setStopping(false)
      }
    } catch (error: unknown) {
      setStopping(false)
      setSendError(error instanceof Error ? error.message : String(error))
    }
  }, [canStop, deviceSession, sessionId, streaming, t])

  const updateSessionSettings = useCallback(
    async (patch: SessionSettingsPatch) => {
      if (!deviceSession || !sessionId) return null
      setSettingsError(null)
      if (patch.modelSelection !== undefined || patch.modelRef !== undefined) {
        setChatModelDisplay(INITIAL_CHAT_MODEL_DISPLAY)
        lastModelResolvedDedupRef.current = null
      }
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
        let initialSelection: ModelSelection | undefined
        if (getValidAccessToken) {
          try {
            const token = await getValidAccessToken()
            const strategyResponse = await fetchModelStrategy(token)
            initialSelection = strategyResponse.strategy.taskRouting.chat
          } catch {
            // token 获取或拉取失败时仍创建 session，Server 会在缺 header 时用 taskRouting
          }
        }
        const session = await createCliSession(deviceSession.endpoint, deviceSession.accessToken, {
          agentId: agentId ?? settings?.agentId,
          ...(initialSelection ? { modelSelection: initialSelection } : {}),
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
    [deviceSession, getValidAccessToken, loadSettings, requestSessionListRefresh, routeSessionId, sessionSettings],
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
        sessionTreeRef.current = tree
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
    streamingTurnUsage,
    streamingTurnTokenDisplay,
    agentStartedAt,
    canStop,
    stopping,
    deviceUnreachable,
    connectionError,
    sendError,
    settingsError,
    treeError,
    compacting,
    chatModelDisplay,
    chatContextWindow,
    sendMessage,
    retryFromMessage,
    stopGeneration,
    compactContext,
    updateSessionSettings,
    startNewSession,
    navigateToEntry,
    forkFromEntry,
    retryConnection,
  }
}
