import { DAEMON_PROXY_PREFIX } from '@muse-ai/shared'
import type {
  ModelsConfigResponse,
  ProvidersConfigResponse,
  UpdateModelsConfigRequest,
  UpdateProviderApiKeyRequest,
  UpsertCustomProviderRequest,
  UpsertProviderAdvancedConfigRequest,
} from '@muse-ai/shared'

const daemonBaseUrl = DAEMON_PROXY_PREFIX

async function requestDaemon<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${daemonBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const body = (await response.json()) as T | { error?: string }
  if (!response.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `请求失败 (${response.status})`
    throw new Error(message)
  }

  return body as T
}

export function fetchModelsConfig(): Promise<ModelsConfigResponse> {
  return requestDaemon<ModelsConfigResponse>('/settings/models-config')
}

export function updateModelsConfig(input: UpdateModelsConfigRequest): Promise<{ ok: true }> {
  return requestDaemon<{ ok: true }>('/settings/models-config', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function fetchProvidersConfig(): Promise<ProvidersConfigResponse> {
  return requestDaemon<ProvidersConfigResponse>('/settings/providers')
}

export function saveProviderApiKey(
  providerId: string,
  input: UpdateProviderApiKeyRequest,
): Promise<{ ok: true }> {
  return requestDaemon<{ ok: true }>(`/settings/providers/${providerId}/api-key`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteProviderApiKey(providerId: string): Promise<{ ok: true }> {
  return requestDaemon<{ ok: true }>(`/settings/providers/${providerId}/api-key`, {
    method: 'DELETE',
  })
}

export function saveProviderAdvancedConfig(
  providerId: string,
  input: UpsertProviderAdvancedConfigRequest,
): Promise<{ ok: true }> {
  return requestDaemon<{ ok: true }>(`/settings/providers/${providerId}/advanced-config`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function saveCustomProvider(
  providerId: string,
  input: UpsertCustomProviderRequest,
): Promise<{ ok: true }> {
  return requestDaemon<{ ok: true }>(`/settings/providers/custom/${encodeURIComponent(providerId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export function deleteCustomProvider(providerId: string): Promise<{ ok: true }> {
  return requestDaemon<{ ok: true }>(`/settings/providers/custom/${encodeURIComponent(providerId)}`, {
    method: 'DELETE',
  })
}
