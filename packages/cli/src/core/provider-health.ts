import { museModelService } from './model-service'
import type { ProviderHealthStatus } from '@muse-ai/shared'

const authFailureMessages = new Map<string, string>()

/** 对话鉴权失败后标记 provider 不可用 */
export function markProviderAuthFailure(providerId: string, message: string): void {
  authFailureMessages.set(providerId, message.trim())
}

export function clearProviderAuthFailure(providerId: string): void {
  authFailureMessages.delete(providerId)
}

export function getProviderAuthFailureMessage(providerId: string): string | undefined {
  return authFailureMessages.get(providerId)
}

function hasConfigTrace(providerId: string): boolean {
  if (museModelService.hasStoredCredential(providerId)) {
    return true
  }
  return museModelService.hasModelsJsonApiKeyConfig(providerId)
}

function hasResolvableApiKey(providerId: string): boolean {
  const apiKey = museModelService.getApiKey(providerId)
  return Boolean(apiKey?.trim())
}

export function getProviderHealth(providerId: string): ProviderHealthStatus {
  if (authFailureMessages.has(providerId)) {
    return 'broken'
  }

  if (hasResolvableApiKey(providerId)) {
    return 'ready'
  }

  if (hasConfigTrace(providerId)) {
    return 'broken'
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

/** 根据 Agent 报错判断是否为供应方鉴权失败 */
export function isProviderAuthError(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) {
    return false
  }
  return AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(trimmed))
}
