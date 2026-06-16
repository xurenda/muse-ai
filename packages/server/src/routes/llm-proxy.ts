import type { Hono } from 'hono'
import type { LlmProxyService } from '../services/llm-proxy-service.js'
import { SettingsError } from '../services/settings-service.js'
import type { ProviderResolver } from '../services/provider-resolver.js'
import { isProviderAuthError, markProviderAuthFailure } from '../services/provider-health.js'
import type { ServerVariables } from '../types.js'

type ServerApp = Hono<{ Variables: ServerVariables }>

export function registerLlmProxyRoutes(
  app: ServerApp,
  providerResolver: ProviderResolver,
  llmProxy: LlmProxyService,
  deviceAuth: ReturnType<typeof import('../middleware/device-auth.js').createDeviceAuthMiddleware>,
): void {
  app.all('/v1/*', deviceAuth, async c => {
    const deviceAuthCtx = c.get('deviceAuth')
    const suffixPath = c.req.path.replace(/^\/v1/, '') || '/chat/completions'
    const providerHint = c.req.header('x-muse-provider') ?? undefined
    const body: unknown = await c.req.json()

    try {
      const provider = await providerResolver.resolve(deviceAuthCtx.userId, providerHint)
      if (!provider) {
        throw new SettingsError('no_provider', '未配置 LLM Provider：请先在 Web 设置页配置供应方凭证')
      }

      const upstream = await llmProxy.forward(provider, suffixPath, body, c.req.raw.headers, c.req.raw.signal)

      if (!upstream.ok) {
        const errorText = await upstream.clone().text()
        if (isProviderAuthError(errorText)) {
          markProviderAuthFailure(deviceAuthCtx.userId, provider.providerId, errorText.slice(0, 500))
        }
      }

      const contentType = upstream.headers.get('content-type') ?? 'application/json'
      const headers = new Headers()
      headers.set('content-type', contentType)
      const cacheControl = upstream.headers.get('cache-control')
      if (cacheControl) headers.set('cache-control', cacheControl)

      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      })
    } catch (error: unknown) {
      if (error instanceof SettingsError && error.code === 'no_provider') {
        return c.json({ error: error.code, message: error.message }, 503)
      }
      throw error
    }
  })
}
