import { DEFAULT_PORTS } from '@museai/shared'

import { encodeModelSelectionHeader, MUSE_PROXY_HEADERS, type ModelSelection, type MuseLlmTask } from '@museai/shared'

export interface BackendLlmAuthConfig {
  backendUrl: string
  deviceToken: string
}

export interface MuseProxyRequestContext {
  task: MuseLlmTask
  selection?: ModelSelection
  /** 会话 meta 中上次 chat 成功模型；仍在池内时 Server 优先尝试 */
  lastResolvedModelRef?: string
}

function normalizeBackendUrl(url: string): string {
  return url.replace(/\/$/, '')
}

/** 将 LLM 请求导向 Muse Server OpenAI 兼容代理；apiKey 使用 device token */
export function createBackendGetApiKeyAndHeaders(config: BackendLlmAuthConfig, context: MuseProxyRequestContext) {
  return async (_model: { provider: string }): Promise<{ apiKey: string; headers?: Record<string, string> } | undefined> => {
    if (!config.deviceToken) {
      return undefined
    }
    const headers: Record<string, string> = {
      [MUSE_PROXY_HEADERS.TASK]: context.task,
    }
    if (context.selection) {
      headers[MUSE_PROXY_HEADERS.SELECTION] = encodeModelSelectionHeader(context.selection)
    }
    if (context.task === 'chat' && context.lastResolvedModelRef?.trim()) {
      headers[MUSE_PROXY_HEADERS.LAST_RESOLVED_MODEL] = context.lastResolvedModelRef.trim()
    }
    return {
      apiKey: config.deviceToken,
      headers,
    }
  }
}

/** pi-ai 通过 baseUrl 推断 compat；经 Muse 代理后需按 provider 补丁，避免误发 developer role */
const DEVELOPER_ROLE_PROVIDERS = new Set(['openai', 'openai-codex'])

function resolveProxyCompatPatch(model: { provider: string; compat?: { supportsDeveloperRole?: boolean } }): {
  supportsDeveloperRole?: boolean
} {
  if (model.compat?.supportsDeveloperRole !== undefined) {
    return {}
  }
  if (DEVELOPER_ROLE_PROVIDERS.has(model.provider)) {
    return {}
  }
  return { supportsDeveloperRole: false }
}

/** 把 model.baseUrl 重写为 Backend 代理根路径，并保留目标 Provider 的 compat 语义 */
export function withProxyBaseUrl<T extends { baseUrl: string; provider: string; compat?: Record<string, unknown> }>(model: T, backendUrl: string): T {
  const base = normalizeBackendUrl(backendUrl)
  const patch = resolveProxyCompatPatch(model)
  const compat = patch.supportsDeveloperRole !== undefined || model.compat ? { ...model.compat, ...patch } : model.compat
  return {
    ...model,
    baseUrl: `${base}/v1`,
    ...(compat ? { compat } : {}),
  }
}

export function resolveBackendUrl(configured?: string): string {
  return normalizeBackendUrl(configured ?? `http://127.0.0.1:${DEFAULT_PORTS.SERVER}`)
}
