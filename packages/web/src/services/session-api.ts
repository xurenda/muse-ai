import { DAEMON_PROXY_PREFIX } from '@muse-ai/shared'
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionResponse,
  SessionPromptRequest,
  SessionPromptResponse,
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

export function getSession(sessionId: string): Promise<GetSessionResponse> {
  return requestDaemon<GetSessionResponse>(`/sessions/${sessionId}`)
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

export function buildSessionEventsUrl(sessionId: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${daemonBaseUrl}/sessions/${sessionId}/events`
}
