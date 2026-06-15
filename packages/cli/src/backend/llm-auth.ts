import { DEFAULT_PORTS } from '@muse-ai/shared'

export interface BackendLlmAuthConfig {
  backendUrl: string
  deviceToken: string
}

function normalizeBackendUrl(url: string): string {
  return url.replace(/\/$/, '')
}

/** 将 LLM 请求导向 Muse Server OpenAI 兼容代理；apiKey 使用 device token */
export function createBackendGetApiKeyAndHeaders(config: BackendLlmAuthConfig) {
  return async (): Promise<{ apiKey: string; headers?: Record<string, string> } | undefined> => {
    if (!config.deviceToken) {
      return undefined
    }
    return { apiKey: config.deviceToken }
  }
}

/** 把 model.baseUrl 重写为 Backend 代理根路径 */
export function withProxyBaseUrl<T extends { baseUrl: string }>(model: T, backendUrl: string): T {
  const base = normalizeBackendUrl(backendUrl)
  return {
    ...model,
    baseUrl: `${base}/v1`,
  }
}

export function resolveBackendUrl(configured?: string): string {
  return normalizeBackendUrl(configured ?? `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`)
}
