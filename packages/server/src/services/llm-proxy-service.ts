import type { ResolvedProvider } from './provider-service.js'
import { ProviderError } from './provider-service.js'

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

export class LlmProxyService {
  async forward(provider: ResolvedProvider, body: unknown, signal?: AbortSignal): Promise<Response> {
    const targetUrl = joinUrl(provider.baseUrl, '/chat/completions')
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    })
    return response
  }

  async forwardForUser(resolve: () => Promise<ResolvedProvider | undefined>, body: unknown, signal?: AbortSignal): Promise<Response> {
    const provider = await resolve()
    if (!provider) {
      throw new ProviderError('no_provider', '未配置 LLM Provider：请先在 Web 设置页添加 OpenAI 兼容 Provider 并设为默认')
    }
    return this.forward(provider, body, signal)
  }
}
