import {
  CLI_API_PATHS,
  SERVER_API_PATHS,
  deviceCredentialsPath,
  marketPackageDetailPath,
  type Device,
  type DeviceCredentialsResponse,
  type LoginRequest,
  type LoginResponse,
  type MarketPackageDetail,
  type MarketPackageListResponse,
  type PairInitResponse,
  type RegisterRequest,
  type RefreshTokenResponse,
} from '@museai/shared'
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

export async function refreshToken(token: string): Promise<RefreshTokenResponse> {
  const res = await fetch(`${backendBaseUrl}${SERVER_API_PATHS.AUTH_REFRESH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
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

export async function listMarketPackages(userToken: string): Promise<MarketPackageListResponse> {
  const res = await fetch(`${backendBaseUrl}${SERVER_API_PATHS.MARKET_PACKAGES}`, {
    headers: authHeaders(userToken),
  })
  return parseJsonResponse(res)
}

export async function getMarketPackageDetail(userToken: string, packageId: string): Promise<MarketPackageDetail> {
  const res = await fetch(`${backendBaseUrl}${marketPackageDetailPath(packageId)}`, {
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
