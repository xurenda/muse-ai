import { DAEMON_PROXY_PREFIX } from '@muse-ai/shared'
import type { DaemonHealthResponse, DaemonInfoResponse } from '@muse-ai/shared'

const daemonBaseUrl = DAEMON_PROXY_PREFIX

async function fetchDaemon<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${daemonBaseUrl}${path}`)
    if (!response.ok) {
      return null
    }
    return (await response.json()) as T
  } catch {
    return null
  }
}

export async function fetchDaemonHealth(): Promise<DaemonHealthResponse | null> {
  return fetchDaemon<DaemonHealthResponse>('/health')
}

export async function fetchDaemonInfo(): Promise<DaemonInfoResponse | null> {
  return fetchDaemon<DaemonInfoResponse>('/info')
}
