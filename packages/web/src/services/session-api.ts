import { DAEMON_PROXY_PREFIX } from '@muse-ai/shared'
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  DeleteSessionResponse,
  GetSessionResponse,
  GetSessionTraceResponse,
  ListSessionTracesResponse,
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

export function listSessionTraces(sessionId: string): Promise<ListSessionTracesResponse> {
  return requestDaemon<ListSessionTracesResponse>(`/sessions/${encodeURIComponent(sessionId)}/traces`)
}

export function getSessionTrace(sessionId: string, turnIndex: number): Promise<GetSessionTraceResponse> {
  return requestDaemon<GetSessionTraceResponse>(
    `/sessions/${encodeURIComponent(sessionId)}/traces/${turnIndex}`,
  )
}

export function buildSessionEventsUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${daemonBaseUrl}/sessions/${sessionId}/events`
}
