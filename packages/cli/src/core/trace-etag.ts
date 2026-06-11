import { createHash } from 'node:crypto'
import type { GetSessionTraceResponse } from '@muse-ai/shared'

/** 基于 trace 快照摘要生成 ETag（强校验） */
export function computeSessionTraceETag(response: GetSessionTraceResponse): string {
  const fingerprint = {
    updatedAt: response.updatedAt ?? '',
    requestCapturedAt: response.request?.capturedAt ?? '',
    responseCapturedAt: response.response?.capturedAt ?? '',
    responseStatus: response.response?.status ?? null,
  }
  const digest = createHash('sha256').update(JSON.stringify(fingerprint)).digest('hex').slice(0, 16)
  return `"${digest}"`
}

function normalizeETag(value: string): string {
  return value.trim().replace(/^W\//, '').replace(/^"|"$/g, '')
}

/** 判断 If-None-Match 是否与当前 ETag 一致（支持逗号分隔的多值） */
export function matchesIfNoneMatch(ifNoneMatch: string | string[] | undefined, etag: string): boolean {
  if (!ifNoneMatch) {
    return false
  }

  const candidates = Array.isArray(ifNoneMatch) ? ifNoneMatch : ifNoneMatch.split(',')
  const normalizedCurrent = normalizeETag(etag)

  return candidates.some((candidate) => normalizeETag(candidate) === normalizedCurrent)
}
