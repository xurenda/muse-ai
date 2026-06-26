import { createHash } from 'node:crypto'
import { BASIC_KIT_PACKAGE_ID } from '@museai/shared'

/** musepack 内 agent 目录 slug → 稳定 UUID（同包同 slug 重装不变） */
export function resolveAgentId(packageId: string, slug: string, explicitId?: string): string {
  if (explicitId) return explicitId
  const hash = createHash('sha256').update(`muse-agent:${packageId}:${slug}`).digest()
  const bytes = Uint8Array.from(hash.subarray(0, 16))
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

/** `museai/basic-kit` 内 agent 稳定 id（由 slug 派生） */
export function basicKitAgentId(slug: string): string {
  return resolveAgentId(BASIC_KIT_PACKAGE_ID, slug)
}
