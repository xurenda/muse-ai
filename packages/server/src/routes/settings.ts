import type { Hono } from 'hono'
import {
  SERVER_API_PATHS,
  updateModelStrategyRequestSchema,
  updateModelsConfigRequestSchema,
  updateProviderApiKeyRequestSchema,
  upsertCustomProviderRequestSchema,
  upsertProviderAdvancedConfigRequestSchema,
} from '@museai/shared'
import type { SettingsService } from '../services/settings-service.js'
import { SettingsError } from '../services/settings-service.js'
import type { ServerVariables } from '../types.js'

type ServerApp = Hono<{ Variables: ServerVariables }>

export function registerSettingsRoutes(
  app: ServerApp,
  settingsService: SettingsService,
  userAuth: ReturnType<typeof import('../middleware/user-auth.js').createUserAuthMiddleware>,
): void {
  app.get(SERVER_API_PATHS.SETTINGS_MODELS_CONFIG, userAuth, async c => {
    const user = c.get('user')
    return c.json(await settingsService.getModelsConfig(user.id))
  })

  app.patch(SERVER_API_PATHS.SETTINGS_MODELS_CONFIG, userAuth, async c => {
    const user = c.get('user')
    const json: unknown = await c.req.json()
    const parsed = updateModelsConfigRequestSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }

    try {
      await settingsService.updateModelsConfig(user.id, parsed.data)
      return c.json({ ok: true as const })
    } catch (error: unknown) {
      if (error instanceof SettingsError) {
        return c.json({ error: error.code, message: error.message }, 400)
      }
      throw error
    }
  })

  app.get(SERVER_API_PATHS.SETTINGS_MODEL_STRATEGY, userAuth, async c => {
    const user = c.get('user')
    return c.json(await settingsService.getModelStrategy(user.id))
  })

  app.put(SERVER_API_PATHS.SETTINGS_MODEL_STRATEGY, userAuth, async c => {
    const user = c.get('user')
    const json: unknown = await c.req.json()
    const parsed = updateModelStrategyRequestSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }

    try {
      await settingsService.updateModelStrategy(user.id, parsed.data)
      return c.json({ ok: true as const })
    } catch (error: unknown) {
      if (error instanceof SettingsError) {
        return c.json({ error: error.code, message: error.message }, 400)
      }
      throw error
    }
  })

  app.get(SERVER_API_PATHS.SETTINGS_PROVIDERS, userAuth, async c => {
    const user = c.get('user')
    return c.json(await settingsService.getProvidersConfig(user.id))
  })

  app.put('/settings/providers/:providerId/api-key', userAuth, async c => {
    const user = c.get('user')
    const providerId = c.req.param('providerId')
    const json: unknown = await c.req.json()
    const parsed = updateProviderApiKeyRequestSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }

    try {
      await settingsService.saveProviderApiKey(user.id, providerId, parsed.data.apiKey)
      return c.json({ ok: true as const })
    } catch (error: unknown) {
      if (error instanceof SettingsError) {
        return c.json({ error: error.code, message: error.message }, 400)
      }
      throw error
    }
  })

  app.delete('/settings/providers/:providerId/api-key', userAuth, async c => {
    const user = c.get('user')
    const providerId = c.req.param('providerId')
    await settingsService.deleteProviderApiKey(user.id, providerId)
    return c.json({ ok: true as const })
  })

  app.put('/settings/providers/:providerId/advanced-config', userAuth, async c => {
    const user = c.get('user')
    const providerId = c.req.param('providerId')
    const json: unknown = await c.req.json()
    const parsed = upsertProviderAdvancedConfigRequestSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }

    try {
      await settingsService.saveBuiltinProviderAdvanced(user.id, providerId, parsed.data)
      return c.json({ ok: true as const })
    } catch (error: unknown) {
      if (error instanceof SettingsError) {
        return c.json({ error: error.code, message: error.message }, 400)
      }
      throw error
    }
  })

  app.put('/settings/providers/custom/:providerId', userAuth, async c => {
    const user = c.get('user')
    const providerId = decodeURIComponent(c.req.param('providerId'))
    const json: unknown = await c.req.json()
    const parsed = upsertCustomProviderRequestSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }

    try {
      await settingsService.saveCustomProvider(user.id, providerId, parsed.data)
      return c.json({ ok: true as const })
    } catch (error: unknown) {
      if (error instanceof SettingsError) {
        return c.json({ error: error.code, message: error.message }, 400)
      }
      throw error
    }
  })

  app.delete('/settings/providers/custom/:providerId', userAuth, async c => {
    const user = c.get('user')
    const providerId = decodeURIComponent(c.req.param('providerId'))
    await settingsService.deleteCustomProvider(user.id, providerId)
    return c.json({ ok: true as const })
  })
}
