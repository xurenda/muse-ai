import {
  CLI_API_PATHS,
  SERVER_API_PATHS,
  deviceCredentialsPath,
  type Device,
  type DeviceCredentialsResponse,
  type LoginRequest,
  type LoginResponse,
  type PairInitResponse,
  type RegisterRequest,
  type ProviderCreate,
  type ProviderSummary,
  type ProviderUpdate,
} from '@muse-ai/shared'
import { backendBaseUrl } from '@/lib/config'

export class BackendApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message)
    this.name = 'BackendApiError'
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const body: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = body as { error?: string; message?: string }
    throw new BackendApiError(res.status, err.error, err.message ?? `请求失败 (${res.status})`)
  }
  return body as T
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const res = await fetch(`${backendBaseUrl}${SERVER_API_PATHS.AUTH_LOGIN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return parseJsonResponse(res)
}

export async function register(request: RegisterRequest): Promise<LoginResponse> {
  const res = await fetch(`${backendBaseUrl}${SERVER_API_PATHS.AUTH_REGISTER}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  return parseJsonResponse(res)
}

export async function listDevices(userToken: string): Promise<Device[]> {
  const res = await fetch(`${backendBaseUrl}${SERVER_API_PATHS.DEVICES}`, {
    headers: authHeaders(userToken),
  })
  const body = await parseJsonResponse<{ devices: Device[] }>(res)
  return body.devices
}

export async function initDevicePair(userToken: string): Promise<PairInitResponse> {
  const res = await fetch(`${backendBaseUrl}${SERVER_API_PATHS.DEVICES_PAIR_INIT}`, {
    method: 'POST',
    headers: authHeaders(userToken),
  })
  return parseJsonResponse(res)
}

export async function getDeviceCredentials(userToken: string, deviceId: string): Promise<DeviceCredentialsResponse> {
  const res = await fetch(`${backendBaseUrl}${deviceCredentialsPath(deviceId)}`, {
    headers: authHeaders(userToken),
  })
  return parseJsonResponse(res)
}

export async function checkCliHealth(endpoint: string, accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint}${CLI_API_PATHS.HEALTH}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return false
    const body = (await res.json()) as { ok?: boolean; service?: string }
    return body.ok === true && body.service === 'cli'
  } catch {
    return false
  }
}

export async function listProviders(userToken: string): Promise<ProviderSummary[]> {
  const res = await fetch(`${backendBaseUrl}${SERVER_API_PATHS.PROVIDERS}`, { headers: authHeaders(userToken) })
  const body = await parseJsonResponse<{ providers: ProviderSummary[] }>(res)
  return body.providers
}

export async function createProvider(userToken: string, request: ProviderCreate): Promise<ProviderSummary> {
  const res = await fetch(`${backendBaseUrl}${SERVER_API_PATHS.PROVIDERS}`, {
    method: 'POST',
    headers: authHeaders(userToken),
    body: JSON.stringify(request),
  })
  const body = await parseJsonResponse<{ provider: ProviderSummary }>(res)
  return body.provider
}

export async function updateProvider(userToken: string, providerId: string, request: ProviderUpdate): Promise<ProviderSummary> {
  const res = await fetch(`${backendBaseUrl}${SERVER_API_PATHS.PROVIDERS}/${providerId}`, {
    method: 'PUT',
    headers: authHeaders(userToken),
    body: JSON.stringify(request),
  })
  const body = await parseJsonResponse<{ provider: ProviderSummary }>(res)
  return body.provider
}

export async function deleteProvider(userToken: string, providerId: string): Promise<void> {
  const res = await fetch(`${backendBaseUrl}${SERVER_API_PATHS.PROVIDERS}/${providerId}`, {
    method: 'DELETE',
    headers: authHeaders(userToken),
  })
  if (!res.ok) {
    await parseJsonResponse(res)
  }
}
