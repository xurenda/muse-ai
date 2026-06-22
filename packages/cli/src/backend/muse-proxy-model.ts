import { resolveBackendUrl } from './llm-auth.js'

export const MUSE_PROXY_MODEL_REF = 'muse/proxy'

/** Harness 使用的占位 Model：真实 upstream 由 Server 按 X-Muse-* 解析 */
export function createMuseProxyModel(backendUrl?: string) {
  const base = resolveBackendUrl(backendUrl).replace(/\/$/, '')
  return {
    id: 'proxy',
    name: 'Muse Proxy',
    api: 'openai-completions' as const,
    provider: 'muse',
    baseUrl: `${base}/v1`,
    reasoning: false,
    input: ['text' as const],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8_192,
  }
}
