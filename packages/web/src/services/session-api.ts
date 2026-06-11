import { DAEMON_PROXY_PREFIX } from '@muse-ai/shared'
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  DeleteSessionResponse,
  GetSessionResponse,
  GetSessionTraceResponse,
  ListSessionsResponse,
  SessionAbortResponse,
  SessionFollowUpRequest,
  SessionFollowUpResponse,
  SessionPromptRequest,
  SessionPromptResponse,
  SessionSteerRequest,
  SessionSteerResponse,
} from '@muse-ai/shared'

const daemonBaseUrl = DAEMON_PROXY_PREFIX

async function requestDaemon<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${daemonBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const body = (await response.json()) as T | { error?: string }
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `请求失败 (${response.status})`
    throw new Error(message)
  }

  return body as T
}

export function createSession(input: CreateSessionRequest = {}): Promise<CreateSessionResponse> {
  return requestDaemon<CreateSessionResponse>('/sessions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function listSessions(agentId?: string): Promise<ListSessionsResponse> {
  const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : ''
  return requestDaemon<ListSessionsResponse>(`/sessions${query}`)
}

export function getSession(sessionId: string): Promise<GetSessionResponse> {
  return requestDaemon<GetSessionResponse>(`/sessions/${sessionId}`)
}

export function deleteSession(sessionId: string): Promise<DeleteSessionResponse> {
  return requestDaemon<DeleteSessionResponse>(`/sessions/${sessionId}`, {
    method: 'DELETE',
  })
}

export function sendSessionPrompt(
  sessionId: string,
  input: SessionPromptRequest,
): Promise<SessionPromptResponse> {
  return requestDaemon<SessionPromptResponse>(`/sessions/${sessionId}/prompt`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function abortSession(sessionId: string): Promise<SessionAbortResponse> {
  return requestDaemon<SessionAbortResponse>(`/sessions/${sessionId}/abort`, {
    method: 'POST',
  })
}

export function sendSessionSteer(
  sessionId: string,
  input: SessionSteerRequest,
): Promise<SessionSteerResponse> {
  return requestDaemon<SessionSteerResponse>(`/sessions/${sessionId}/steer`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function sendSessionFollowUp(
  sessionId: string,
  input: SessionFollowUpRequest,
): Promise<SessionFollowUpResponse> {
  return requestDaemon<SessionFollowUpResponse>(`/sessions/${sessionId}/follow-up`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export interface GetSessionTraceResult {
  notModified: boolean
  etag: string | null
  data: GetSessionTraceResponse | null
}

export function getSessionTrace(
  sessionId: string,
  options?: { ifNoneMatch?: string },
): Promise<GetSessionTraceResult> {
  const headers: Record<string, string> = {}
  if (options?.ifNoneMatch) {
    headers['If-None-Match'] = options.ifNoneMatch
  }

  return fetch(`${daemonBaseUrl}/sessions/${encodeURIComponent(sessionId)}/trace`, {
    headers,
  }).then(async (response) => {
    const etag = response.headers.get('ETag')

    if (response.status === 304) {
      return {
        notModified: true,
        etag,
        data: null,
      }
    }

    const body = (await response.json()) as GetSessionTraceResponse | { error?: string }
    if (!response.ok) {
      const message =
        typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
          ? body.error
          : `请求失败 (${response.status})`
      throw new Error(message)
    }

    return {
      notModified: false,
      etag,
      data: body as GetSessionTraceResponse,
    }
  })
}

export function buildSessionEventsUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${daemonBaseUrl}/sessions/${sessionId}/events`
}
