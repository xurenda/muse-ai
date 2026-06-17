import { CliApiError } from '@/api/cli-client'

export type ConnectionErrorCode = 'cli_unreachable' | 'sse_subscribe_failed' | 'unknown'

export interface ParsedConnectionError {
  code: ConnectionErrorCode
  detail?: string
}

const CONNECTION_ERROR_I18N_KEYS: Record<ConnectionErrorCode, string> = {
  cli_unreachable: 'errorCliUnreachable',
  sse_subscribe_failed: 'errorSseSubscribeFailed',
  unknown: 'errorConnectionUnknown',
}

/** 将连接异常规范为可 i18n 的错误码 */
export function parseConnectionError(error: unknown): ParsedConnectionError {
  if (error instanceof Error && error.message === 'cli_unreachable') {
    return { code: 'cli_unreachable' }
  }
  if (error instanceof CliApiError) {
    if (error.code === 'sse_subscribe_failed') {
      return { code: 'sse_subscribe_failed', detail: String(error.status) }
    }
    return { code: 'unknown', detail: error.message }
  }
  if (error instanceof Error) {
    return { code: 'unknown', detail: error.message }
  }
  return { code: 'unknown', detail: String(error) }
}

export function formatConnectionErrorMessage(parsed: ParsedConnectionError, t: (key: string, options?: Record<string, unknown>) => string): string {
  const key = CONNECTION_ERROR_I18N_KEYS[parsed.code]
  if (parsed.code === 'sse_subscribe_failed' && parsed.detail) {
    return t(key, { status: parsed.detail })
  }
  if (parsed.code === 'unknown') {
    return t(key, { message: parsed.detail ?? t('errorUnknownDetail') })
  }
  return t(key)
}
