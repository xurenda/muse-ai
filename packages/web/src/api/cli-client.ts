import {
  CLI_API_PATHS,
  deviceEventsPath,
  deviceSseEventSchema,
  museSseEventSchema,
  sessionDetailPath,
  sessionCompactPath,
  sessionAbortPath,
  sessionEventsPath,
  sessionForkPath,
  sessionNavigatePath,
  sessionSettingsPath,
  sessionTreePath,
  type AgentDefinition,
  type ChatRequest,
  type CreateAgentRequest,
  type CreateSessionRequest,
  type DeviceSseEvent,
  type MuseSseEvent,
  type Persona,
  type SessionMeta,
  type SessionNavigateRequest,
  type SessionSettingsPatch,
  type SessionSettingsResponse,
  type SessionForkRequest,
  type SessionCompactRequest,
  type SessionTreeResponse,
  type SkillMeta,
  type ToolDescriptor,
} from '@museai/shared'
import { computeSseBackoffMs, waitForSseRetry } from '@/lib/sse-reconnect'

export class CliApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message)
    this.name = 'CliApiError'
  }
}

function cliHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

async function parseCliJson<T>(res: Response): Promise<T> {
  const body: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = body as { error?: string; message?: string }
    throw new CliApiError(res.status, err.error, err.message ?? `CLI 请求失败 (${res.status})`)
  }
  return body as T
}

export async function createCliSession(endpoint: string, accessToken: string, request: CreateSessionRequest = {}): Promise<SessionMeta> {
  const res = await fetch(`${endpoint}${CLI_API_PATHS.SESSIONS}`, {
    method: 'POST',
    headers: cliHeaders(accessToken),
    body: JSON.stringify(request),
  })
  const body = await parseCliJson<{ session: SessionMeta }>(res)
  return body.session
}

export async function listCliAgents(endpoint: string, accessToken: string): Promise<AgentDefinition[]> {
  const res = await fetch(`${endpoint}${CLI_API_PATHS.AGENTS}`, { headers: cliHeaders(accessToken) })
  const body = await parseCliJson<{ agents: AgentDefinition[] }>(res)
  return body.agents
}

export async function listPersonas(endpoint: string, accessToken: string): Promise<Persona[]> {
  const res = await fetch(`${endpoint}${CLI_API_PATHS.PERSONAS}`, { headers: cliHeaders(accessToken) })
  const body = await parseCliJson<{ personas: Persona[] }>(res)
  return body.personas
}

export async function listSkills(endpoint: string, accessToken: string): Promise<SkillMeta[]> {
  const res = await fetch(`${endpoint}${CLI_API_PATHS.SKILLS}`, { headers: cliHeaders(accessToken) })
  const body = await parseCliJson<{ skills: SkillMeta[] }>(res)
  return body.skills
}

export async function listTools(endpoint: string, accessToken: string): Promise<ToolDescriptor[]> {
  const res = await fetch(`${endpoint}${CLI_API_PATHS.TOOLS}`, { headers: cliHeaders(accessToken) })
  const body = await parseCliJson<{ tools: ToolDescriptor[] }>(res)
  return body.tools
}

export async function createAgent(endpoint: string, accessToken: string, request: CreateAgentRequest): Promise<AgentDefinition> {
  const res = await fetch(`${endpoint}${CLI_API_PATHS.AGENTS}`, {
    method: 'POST',
    headers: cliHeaders(accessToken),
    body: JSON.stringify(request),
  })
  const body = await parseCliJson<{ agent: AgentDefinition }>(res)
  return body.agent
}

export async function listCliSessions(endpoint: string, accessToken: string): Promise<SessionMeta[]> {
  const res = await fetch(`${endpoint}${CLI_API_PATHS.SESSIONS}`, { headers: cliHeaders(accessToken) })
  const body = await parseCliJson<{ sessions: SessionMeta[] }>(res)
  return body.sessions
}

export async function patchCliSession(endpoint: string, accessToken: string, sessionId: string, name: string): Promise<SessionMeta> {
  const res = await fetch(`${endpoint}${sessionDetailPath(sessionId)}`, {
    method: 'PATCH',
    headers: cliHeaders(accessToken),
    body: JSON.stringify({ name }),
  })
  const body = await parseCliJson<{ session: SessionMeta }>(res)
  return body.session
}

export async function deleteCliSession(endpoint: string, accessToken: string, sessionId: string): Promise<void> {
  const res = await fetch(`${endpoint}${sessionDetailPath(sessionId)}`, {
    method: 'DELETE',
    headers: cliHeaders(accessToken),
  })
  await parseCliJson<{ deleted: boolean; sessionId: string }>(res)
}

export async function getSessionTree(endpoint: string, accessToken: string, sessionId: string): Promise<SessionTreeResponse> {
  const res = await fetch(`${endpoint}${sessionTreePath(sessionId)}`, { headers: cliHeaders(accessToken) })
  return parseCliJson(res)
}

export async function navigateSession(endpoint: string, accessToken: string, sessionId: string, request: SessionNavigateRequest): Promise<SessionTreeResponse> {
  const res = await fetch(`${endpoint}${sessionNavigatePath(sessionId)}`, {
    method: 'POST',
    headers: cliHeaders(accessToken),
    body: JSON.stringify(request),
  })
  return parseCliJson(res)
}

export async function forkSession(endpoint: string, accessToken: string, sessionId: string, request: SessionForkRequest = {}): Promise<SessionMeta> {
  const res = await fetch(`${endpoint}${sessionForkPath(sessionId)}`, {
    method: 'POST',
    headers: cliHeaders(accessToken),
    body: JSON.stringify(request),
  })
  const body = await parseCliJson<{ session: SessionMeta }>(res)
  return body.session
}

export async function compactSession(endpoint: string, accessToken: string, sessionId: string, request: SessionCompactRequest = {}): Promise<void> {
  const res = await fetch(`${endpoint}${sessionCompactPath(sessionId)}`, {
    method: 'POST',
    headers: cliHeaders(accessToken),
    body: JSON.stringify(request),
  })
  if (res.status !== 202) {
    const text = await res.text()
    let code: string | undefined
    let message = text || `压缩上下文失败 (${res.status})`
    try {
      const body = JSON.parse(text) as { error?: string; message?: string }
      code = body.error
      if (body.message) message = body.message
    } catch {
      // 非 JSON 响应，保留原始 text
    }
    throw new CliApiError(res.status, code, message)
  }
}

export async function abortSession(endpoint: string, accessToken: string, sessionId: string): Promise<{ aborted: boolean }> {
  const res = await fetch(`${endpoint}${sessionAbortPath(sessionId)}`, {
    method: 'POST',
    headers: cliHeaders(accessToken),
  })
  if (res.status !== 202) {
    const text = await res.text()
    let code: string | undefined
    let message = text || `停止生成失败 (${res.status})`
    try {
      const body = JSON.parse(text) as { error?: string; message?: string }
      code = body.error
      if (body.message) message = body.message
    } catch {
      // 非 JSON 响应，保留原始 text
    }
    throw new CliApiError(res.status, code, message)
  }
  return parseCliJson<{ aborted: boolean }>(res)
}

export async function getSessionSettings(endpoint: string, accessToken: string, sessionId: string): Promise<SessionSettingsResponse> {
  const res = await fetch(`${endpoint}${sessionSettingsPath(sessionId)}`, { headers: cliHeaders(accessToken) })
  return parseCliJson(res)
}

export async function patchSessionSettings(
  endpoint: string,
  accessToken: string,
  sessionId: string,
  patch: SessionSettingsPatch,
): Promise<SessionSettingsResponse> {
  const res = await fetch(`${endpoint}${sessionSettingsPath(sessionId)}`, {
    method: 'PATCH',
    headers: cliHeaders(accessToken),
    body: JSON.stringify(patch),
  })
  return parseCliJson(res)
}

export async function postChat(endpoint: string, accessToken: string, request: ChatRequest): Promise<void> {
  const res = await fetch(`${endpoint}${CLI_API_PATHS.CHAT}`, {
    method: 'POST',
    headers: cliHeaders(accessToken),
    body: JSON.stringify(request),
  })
  if (res.status !== 202) {
    const text = await res.text()
    let code: string | undefined
    let message = text || `发起对话失败 (${res.status})`
    try {
      const body = JSON.parse(text) as { error?: string; message?: string }
      code = body.error
      if (body.message) message = body.message
    } catch {
      // 非 JSON 响应，保留原始 text
    }
    throw new CliApiError(res.status, code, message)
  }
}

/** 从 SSE 字节流解析 Muse 事件 */
export function parseSseBuffer(buffer: string): { events: MuseSseEvent[]; remainder: string } {
  const events: MuseSseEvent[] = []
  const lines = buffer.split('\n')
  const remainder = lines.pop() ?? ''
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice('data: '.length)
    try {
      const parsed: unknown = JSON.parse(payload)
      const result = museSseEventSchema.safeParse(parsed)
      if (result.success) events.push(result.data)
    } catch {
      // 忽略解析失败行
    }
  }
  return { events, remainder }
}

/** 从 SSE 字节流解析设备级事件 */
export function parseDeviceSseBuffer(buffer: string): { events: DeviceSseEvent[]; remainder: string } {
  const events: DeviceSseEvent[] = []
  const lines = buffer.split('\n')
  const remainder = lines.pop() ?? ''
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice('data: '.length)
    try {
      const parsed: unknown = JSON.parse(payload)
      const result = deviceSseEventSchema.safeParse(parsed)
      if (result.success) events.push(result.data)
    } catch {
      // 忽略解析失败行
    }
  }
  return { events, remainder }
}

const SSE_RECONNECT_MS = 1000

export interface SseSubscriptionCallbacks {
  onEvent: (event: MuseSseEvent) => void
  /** 首次建立 SSE 连接 */
  onConnected?: () => void
  /** 已连接后流断开，即将重试 */
  onReconnecting?: () => void
  /** 断线后重连成功 */
  onReconnected?: () => void
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

async function readSseStream(body: ReadableStream<Uint8Array>, signal: AbortSignal, onEvent: (event: MuseSseEvent) => void): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (!signal.aborted) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parsed = parseSseBuffer(buffer)
    buffer = parsed.remainder
    for (const event of parsed.events) {
      onEvent(event)
    }
  }
}

export interface DeviceSseSubscriptionCallbacks {
  onEvent: (event: DeviceSseEvent) => void
  onConnecting?: () => void
  onConnected?: () => void
  onConnectFailed?: () => void
  /** 即将等待重连；delayMs 为本次退避时长 */
  onReconnecting?: (delayMs: number) => void
  onCountdown?: (remainingMs: number) => void
  onReconnected?: () => void
}

async function readDeviceSseStream(body: ReadableStream<Uint8Array>, signal: AbortSignal, onEvent: (event: DeviceSseEvent) => void): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (!signal.aborted) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parsed = parseDeviceSseBuffer(buffer)
    buffer = parsed.remainder
    for (const event of parsed.events) {
      onEvent(event)
    }
  }
}

/** 订阅设备级 SSE（指数退避重连 + 倒计时；返回 retryNow 立即重连） */
export function subscribeDeviceEvents(
  endpoint: string,
  accessToken: string,
  callbacks: DeviceSseSubscriptionCallbacks,
  signal: AbortSignal,
): { retryNow: () => void } {
  let retryAttempt = 0
  let wakeRetry: (() => void) | undefined

  const retryNow = () => {
    retryAttempt = 0
    wakeRetry?.()
  }

  void (async () => {
    let everConnected = false

    while (!signal.aborted) {
      try {
        if (retryAttempt > 0) {
          const delayMs = computeSseBackoffMs(retryAttempt)
          callbacks.onReconnecting?.(delayMs)
          const waitResult = await waitForSseRetry({
            delayMs,
            signal,
            onCountdown: ms => callbacks.onCountdown?.(ms),
            registerWake: wake => {
              wakeRetry = wake
            },
          })
          if (waitResult === 'aborted') return
          wakeRetry = undefined
        } else if (!everConnected) {
          callbacks.onConnecting?.()
        }

        const res = await fetch(`${endpoint}${deviceEventsPath()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal,
        })
        if (!res.ok || !res.body) {
          throw new CliApiError(res.status, 'sse_subscribe_failed', `订阅设备 SSE 失败 (${res.status})`)
        }

        if (everConnected) {
          callbacks.onReconnected?.()
        } else {
          everConnected = true
          callbacks.onConnected?.()
        }
        retryAttempt = 0

        await readDeviceSseStream(res.body, signal, callbacks.onEvent)

        if (signal.aborted) return
        retryAttempt = Math.max(1, retryAttempt + 1)
      } catch (_error: unknown) {
        if (signal.aborted) return
        if (!everConnected && retryAttempt === 0) {
          callbacks.onConnectFailed?.()
        }
        retryAttempt = Math.max(1, retryAttempt + 1)
      }
    }
  })()

  return { retryNow }
}

/** 订阅 Session SSE（fetch 流；浏览器 EventSource 不支持 Authorization） */
export async function subscribeSessionEvents(
  endpoint: string,
  accessToken: string,
  sessionId: string,
  callbacks: SseSubscriptionCallbacks,
  signal: AbortSignal,
): Promise<void> {
  let everConnected = false

  while (!signal.aborted) {
    try {
      const res = await fetch(`${endpoint}${sessionEventsPath(sessionId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal,
      })
      if (!res.ok || !res.body) {
        throw new CliApiError(res.status, 'sse_subscribe_failed', `订阅 SSE 失败 (${res.status})`)
      }

      if (everConnected) {
        callbacks.onReconnected?.()
      } else {
        everConnected = true
        callbacks.onConnected?.()
      }

      await readSseStream(res.body, signal, callbacks.onEvent)

      if (signal.aborted) return
      callbacks.onReconnecting?.()
      await sleep(SSE_RECONNECT_MS, signal)
    } catch (error: unknown) {
      if (signal.aborted) return
      if (!everConnected) throw error
      callbacks.onReconnecting?.()
      await sleep(SSE_RECONNECT_MS, signal)
    }
  }
}
