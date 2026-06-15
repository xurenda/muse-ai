import { DEFAULT_PORTS, SERVER_API_PATHS, devicePairResponseSchema, type DevicePairRequest, type DevicePairResponse } from '@muse-ai/shared'
import { resolveBackendUrl } from './llm-auth.js'

export class BackendClient {
  constructor(private readonly baseUrl: string) {}

  static fromConfig(backendUrl?: string): BackendClient {
    return new BackendClient(resolveBackendUrl(backendUrl))
  }

  async pair(request: DevicePairRequest): Promise<DevicePairResponse> {
    const res = await fetch(`${this.baseUrl}${SERVER_API_PATHS.DEVICES_PAIR}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    const body: unknown = await res.json()
    if (!res.ok) {
      const message = typeof body === 'object' && body !== null && 'message' in body ? String(body.message) : res.statusText
      throw new BackendClientError('pair_failed', message)
    }
    return devicePairResponseSchema.parse(body)
  }

  async heartbeat(deviceToken: string, endpoint?: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}${SERVER_API_PATHS.DEVICES_HEARTBEAT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deviceToken}`,
      },
      body: JSON.stringify({ endpoint, online: true }),
    })
    if (!res.ok) {
      throw new BackendClientError('heartbeat_failed', `心跳失败: ${res.status}`)
    }
  }
}

export class BackendClientError extends Error {
  constructor(
    readonly code: 'pair_failed' | 'heartbeat_failed',
    message: string,
  ) {
    super(message)
    this.name = 'BackendClientError'
  }
}

export function buildCliEndpoint(host: string, port: number): string {
  const normalizedHost = host === '0.0.0.0' ? '127.0.0.1' : host
  return `http://${normalizedHost}:${port}`
}

export function defaultBackendUrl(): string {
  return `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`
}
