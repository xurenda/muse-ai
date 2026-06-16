import type { ProviderHealthStatus } from '@muse-ai/shared'

const authFailureMessages = new Map<string, string>()

export function markProviderAuthFailure(userId: string, providerId: string, message: string): void {
  authFailureMessages.set(`${userId}:${providerId}`, message.trim())
}

export function clearProviderAuthFailure(userId: string, providerId: string): void {
  authFailureMessages.delete(`${userId}:${providerId}`)
}

export function getProviderAuthFailureMessage(userId: string, providerId: string): string | undefined {
  return authFailureMessages.get(`${userId}:${providerId}`)
}

export function getProviderHealth(userId: string, providerId: string, hasCredential: boolean): ProviderHealthStatus {
  const key = `${userId}:${providerId}`
  if (authFailureMessages.has(key)) {
    return 'broken'
  }
  if (hasCredential) {
    return 'ready'
  }
  return 'missing'
}

const AUTH_ERROR_PATTERNS = [
  /\b401\b/,
  /\b403\b/,
  /unauthorized/i,
  /authentication failed/i,
  /invalid api key/i,
  /incorrect api key/i,
  /invalid_api_key/i,
  /api key not valid/i,
  /invalid x-api-key/i,
  /permission denied/i,
  /access denied/i,
  /bearer token.*invalid/i,
]

export function isProviderAuthError(message: string): boolean {
  return AUTH_ERROR_PATTERNS.some(pattern => pattern.test(message))
}
