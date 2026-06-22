import type { Hono } from 'hono'
import { MUSE_PROXY_HEADERS } from '@muse-ai/shared'
import type { LlmProxyOrchestrator } from '../services/llm-proxy-orchestrator.js'
import { SettingsError } from '../services/settings-service.js'
import type { ServerVariables } from '../types.js'

type ServerApp = Hono<{ Variables: ServerVariables }>

export function registerLlmProxyRoutes(
  app: ServerApp,
  orchestrator: LlmProxyOrchestrator,
  deviceAuth: ReturnType<typeof import('../middleware/device-auth.js').createDeviceAuthMiddleware>,
): void {
  app.all('/v1/*', deviceAuth, async c => {
    const deviceAuthCtx = c.get('deviceAuth')
    const suffixPath = c.req.path.replace(/^\/v1/, '') || '/chat/completions'

    let body: unknown = {}
    try {
      body = await c.req.json()
    } catch {
      body = {}
    }

    try {
      return await orchestrator.handle({
        userId: deviceAuthCtx.userId,
        suffixPath,
        body,
        incomingHeaders: c.req.raw.headers,
        signal: c.req.raw.signal,
        taskHeader: c.req.header(MUSE_PROXY_HEADERS.TASK) ?? null,
        selectionHeader: c.req.header(MUSE_PROXY_HEADERS.SELECTION) ?? null,
        lastResolvedModelHeader: c.req.header(MUSE_PROXY_HEADERS.LAST_RESOLVED_MODEL) ?? null,
        providerHint: c.req.header(MUSE_PROXY_HEADERS.PROVIDER) ?? c.req.header('x-muse-provider') ?? undefined,
      })
    } catch (error: unknown) {
      if (error instanceof SettingsError && error.code === 'no_provider') {
        return c.json({ error: error.code, message: error.message }, 503)
      }
      throw error
    }
  })
}
