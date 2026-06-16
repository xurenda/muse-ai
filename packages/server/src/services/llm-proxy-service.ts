import type { ResolvedProxyProvider } from './provider-resolver.js'

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '')
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

function buildForwardHeaders(provider: ResolvedProxyProvider, incoming: Headers): Headers {
  const headers = new Headers()
  headers.set('Content-Type', incoming.get('content-type') ?? 'application/json')

  for (const [key, value] of Object.entries(provider.headers)) {
    if (key.trim()) {
      headers.set(key.trim(), value)
    }
  }

  if (provider.apiKey) {
    headers.set('Authorization', `Bearer ${provider.apiKey}`)
  }

  return headers
}

export class LlmProxyService {
  async forward(provider: ResolvedProxyProvider, path: string, body: unknown, incomingHeaders: Headers, signal?: AbortSignal): Promise<Response> {
    const targetUrl = joinUrl(provider.baseUrl, path)
    const headers = buildForwardHeaders(provider, incomingHeaders)

    return fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    })
  }
}
