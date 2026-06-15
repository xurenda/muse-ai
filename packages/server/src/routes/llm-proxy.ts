import type { Hono } from 'hono'
import { SERVER_API_PATHS } from '@muse-ai/shared'
import type { LlmProxyService } from '../services/llm-proxy-service.js'
import type { ProviderService } from '../services/provider-service.js'
import { ProviderError } from '../services/provider-service.js'
import type { ServerVariables } from '../types.js'

type ServerApp = Hono<{ Variables: ServerVariables }>

export function registerLlmProxyRoutes(
  app: ServerApp,
  providerService: ProviderService,
  llmProxy: LlmProxyService,
  deviceAuth: ReturnType<typeof import('../middleware/device-auth.js').createDeviceAuthMiddleware>,
): void {
  app.post(SERVER_API_PATHS.LLM_PROXY, deviceAuth, async c => {
    const deviceAuthCtx = c.get('deviceAuth')
    const body: unknown = await c.req.json()

    try {
      const upstream = await llmProxy.forwardForUser(() => providerService.resolveDefaultForUser(deviceAuthCtx.userId), body, c.req.raw.signal)

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
      if (error instanceof ProviderError && error.code === 'no_provider') {
        return c.json({ error: error.code, message: error.message }, 503)
      }
      throw error
    }
  })
}
