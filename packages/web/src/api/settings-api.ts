import {
  SERVER_API_PATHS,
  type ModelStrategyResponse,
  type ModelsConfigResponse,
  type ProvidersConfigResponse,
  type UpdateModelStrategyRequest,
  type UpdateModelsConfigRequest,
  type UpdateProviderApiKeyRequest,
  type UpsertCustomProviderRequest,
  type UpsertProviderAdvancedConfigRequest,
} from '@museai/shared'
import { BackendApiError } from '@/api/backend-client'
import { backendBaseUrl } from '@/lib/config'

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
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

export function fetchModelsConfig(userToken: string): Promise<ModelsConfigResponse> {
  return fetch(`${backendBaseUrl}${SERVER_API_PATHS.SETTINGS_MODELS_CONFIG}`, {
    headers: authHeaders(userToken),
  }).then(res => parseJsonResponse(res))
}

export function updateModelsConfig(userToken: string, input: UpdateModelsConfigRequest): Promise<{ ok: true }> {
  return fetch(`${backendBaseUrl}${SERVER_API_PATHS.SETTINGS_MODELS_CONFIG}`, {
    method: 'PATCH',
    headers: authHeaders(userToken),
    body: JSON.stringify(input),
  }).then(res => parseJsonResponse(res))
}

export function fetchModelStrategy(userToken: string): Promise<ModelStrategyResponse> {
  return fetch(`${backendBaseUrl}${SERVER_API_PATHS.SETTINGS_MODEL_STRATEGY}`, {
    headers: authHeaders(userToken),
  }).then(res => parseJsonResponse(res))
}

export function updateModelStrategy(userToken: string, input: UpdateModelStrategyRequest): Promise<{ ok: true }> {
  return fetch(`${backendBaseUrl}${SERVER_API_PATHS.SETTINGS_MODEL_STRATEGY}`, {
    method: 'PUT',
    headers: authHeaders(userToken),
    body: JSON.stringify(input),
  }).then(res => parseJsonResponse(res))
}

export function fetchProvidersConfig(userToken: string): Promise<ProvidersConfigResponse> {
  return fetch(`${backendBaseUrl}${SERVER_API_PATHS.SETTINGS_PROVIDERS}`, {
    headers: authHeaders(userToken),
  }).then(res => parseJsonResponse(res))
}

export function saveProviderApiKey(userToken: string, providerId: string, input: UpdateProviderApiKeyRequest): Promise<{ ok: true }> {
  return fetch(`${backendBaseUrl}/settings/providers/${encodeURIComponent(providerId)}/api-key`, {
    method: 'PUT',
    headers: authHeaders(userToken),
    body: JSON.stringify(input),
  }).then(res => parseJsonResponse(res))
}

export function deleteProviderApiKey(userToken: string, providerId: string): Promise<{ ok: true }> {
  return fetch(`${backendBaseUrl}/settings/providers/${encodeURIComponent(providerId)}/api-key`, {
    method: 'DELETE',
    headers: authHeaders(userToken),
  }).then(res => parseJsonResponse(res))
}

export function saveProviderAdvancedConfig(userToken: string, providerId: string, input: UpsertProviderAdvancedConfigRequest): Promise<{ ok: true }> {
  return fetch(`${backendBaseUrl}/settings/providers/${encodeURIComponent(providerId)}/advanced-config`, {
    method: 'PUT',
    headers: authHeaders(userToken),
    body: JSON.stringify(input),
  }).then(res => parseJsonResponse(res))
}

export function saveCustomProvider(userToken: string, providerId: string, input: UpsertCustomProviderRequest): Promise<{ ok: true }> {
  return fetch(`${backendBaseUrl}/settings/providers/custom/${encodeURIComponent(providerId)}`, {
    method: 'PUT',
    headers: authHeaders(userToken),
    body: JSON.stringify(input),
  }).then(res => parseJsonResponse(res))
}

export function deleteCustomProvider(userToken: string, providerId: string): Promise<{ ok: true }> {
  return fetch(`${backendBaseUrl}/settings/providers/custom/${encodeURIComponent(providerId)}`, {
    method: 'DELETE',
    headers: authHeaders(userToken),
  }).then(res => parseJsonResponse(res))
}
