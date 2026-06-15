import type { Hono } from 'hono'
import { SERVER_API_PATHS, providerCreateSchema, providerUpdateSchema } from '@muse-ai/shared'
import type { ProviderService } from '../services/provider-service.js'
import { ProviderError } from '../services/provider-service.js'
import type { ServerVariables } from '../types.js'

type ServerApp = Hono<{ Variables: ServerVariables }>

export function registerProviderRoutes(
  app: ServerApp,
  providerService: ProviderService,
  userAuth: ReturnType<typeof import('../middleware/user-auth.js').createUserAuthMiddleware>,
): void {
  app.get(SERVER_API_PATHS.PROVIDERS, userAuth, async c => {
    const user = c.get('user')
    const providers = await providerService.list(user.id)
    return c.json({ providers })
  })

  app.post(SERVER_API_PATHS.PROVIDERS, userAuth, async c => {
    const user = c.get('user')
    const json: unknown = await c.req.json()
    const parsed = providerCreateSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    try {
      const provider = await providerService.create(user.id, parsed.data)
      return c.json({ provider }, 201)
    } catch (error: unknown) {
      if (error instanceof ProviderError) {
        return c.json({ error: error.code, message: error.message }, 500)
      }
      throw error
    }
  })

  app.put(`${SERVER_API_PATHS.PROVIDERS}/:providerId`, userAuth, async c => {
    const user = c.get('user')
    const providerId = c.req.param('providerId')
    const json: unknown = await c.req.json()
    const parsed = providerUpdateSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    try {
      const provider = await providerService.update(user.id, providerId, parsed.data)
      return c.json({ provider })
    } catch (error: unknown) {
      if (error instanceof ProviderError && error.code === 'not_found') {
        return c.json({ error: error.code, message: error.message }, 404)
      }
      throw error
    }
  })

  app.delete(`${SERVER_API_PATHS.PROVIDERS}/:providerId`, userAuth, async c => {
    const user = c.get('user')
    const providerId = c.req.param('providerId')
    try {
      await providerService.remove(user.id, providerId)
      return c.body(null, 204)
    } catch (error: unknown) {
      if (error instanceof ProviderError && error.code === 'not_found') {
        return c.json({ error: error.code, message: error.message }, 404)
      }
      throw error
    }
  })
}
