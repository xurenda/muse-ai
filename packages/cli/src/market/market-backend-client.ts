import {
  SERVER_API_PATHS,
  marketInstallUrlRequestSchema,
  marketInstallUrlResponseSchema,
  marketPackageInstallUrlPath,
  type MarketInstallUrlResponse,
} from '@museai/shared'
import { MarketInstallerError } from './market-errors.js'
import { computeMusepackSha256 } from './unpack-musepack.js'

export async function fetchMarketInstallUrl(backendUrl: string, packageId: string, deviceToken: string, version?: string): Promise<MarketInstallUrlResponse> {
  const body = marketInstallUrlRequestSchema.parse(version ? { version } : {})
  const res = await fetch(`${backendUrl.replace(/\/$/, '')}${marketPackageInstallUrlPath(packageId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${deviceToken}`,
    },
    body: JSON.stringify(body),
  })
  const json: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = typeof json === 'object' && json !== null && 'message' in json ? String(json.message) : `请求失败 (${res.status})`
    throw new MarketInstallerError('backend_error', message)
  }
  return marketInstallUrlResponseSchema.parse(json)
}

export async function downloadMusepack(downloadUrl: string, deviceToken: string, expectedSha256?: string): Promise<Uint8Array> {
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${deviceToken}` },
  })
  if (!res.ok) {
    throw new MarketInstallerError('backend_error', `下载失败 (${res.status})`)
  }

  const headerSha256 = res.headers.get('x-muse-pack-sha256')?.toLowerCase()
  const buffer = new Uint8Array(await res.arrayBuffer())
  const sha256 = computeMusepackSha256(buffer)
  const expected = (expectedSha256 ?? headerSha256)?.toLowerCase()
  if (expected && sha256 !== expected) {
    throw new MarketInstallerError('sha256_mismatch', '下载包 sha256 校验失败')
  }
  return buffer
}

export function buildDownloadUrl(backendUrl: string, packageId: string, version: string): string {
  const segments = packageId.split('/').map(segment => encodeURIComponent(segment))
  return `${backendUrl.replace(/\/$/, '')}${SERVER_API_PATHS.MARKET_DOWNLOAD}/${segments.join('/')}/${encodeURIComponent(version)}`
}
