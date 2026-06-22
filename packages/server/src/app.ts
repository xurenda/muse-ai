import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { SERVER_API_PATHS, createHealthResponse, healthResponseSchema } from '@muse-ai/shared'
import type { ServerConfig } from './config.js'
import { createDb, initDatabase } from './db/client.js'
import { createDeviceAuthMiddleware } from './middleware/device-auth.js'
import { createUserAuthMiddleware } from './middleware/user-auth.js'
import { createRedis } from './redis/client.js'
import { registerAuthRoutes, registerDeviceRoutes } from './routes/auth-devices.js'
import { registerLlmProxyRoutes } from './routes/llm-proxy.js'
import { registerSettingsRoutes } from './routes/settings.js'
import { AuthService } from './services/auth-service.js'
import { DeviceService } from './services/device-service.js'
import { createModelResolutionService } from './services/model-resolution-service.js'
import { LlmProxyOrchestrator } from './services/llm-proxy-orchestrator.js'
import { LlmProxyService } from './services/llm-proxy-service.js'
import { ProviderResolver } from './services/provider-resolver.js'
import { SettingsService } from './services/settings-service.js'
import { CredentialStore } from './stores/credential-store.js'
import type { ServerVariables } from './types.js'

export interface ServerContext {
  config: ServerConfig
  authService: AuthService
  settingsService: SettingsService
  providerResolver: ProviderResolver
  deviceService: DeviceService
  llmProxyService: LlmProxyService
  llmProxyOrchestrator: LlmProxyOrchestrator
  close: () => Promise<void>
}

export async function createServerContext(config: ServerConfig): Promise<ServerContext> {
  const { db, pool } = createDb(config.databaseUrl)
  await initDatabase(pool)

  const redis = createRedis(config.redisUrl)
  await redis.connect()

  const authService = new AuthService(db, config.jwtSecret)
  const credentialStore = new CredentialStore(db, config.encryptionKey)
  const settingsService = new SettingsService(db, credentialStore)
  const providerResolver = new ProviderResolver(db, credentialStore)
  const deviceService = new DeviceService(db, redis, config.encryptionKey)
  const llmProxyService = new LlmProxyService()
  const modelResolutionService = createModelResolutionService(settingsService)
  const llmProxyOrchestrator = new LlmProxyOrchestrator(modelResolutionService, providerResolver, llmProxyService)

  return {
    config,
    authService,
    settingsService,
    providerResolver,
    deviceService,
    llmProxyService,
    llmProxyOrchestrator,
    close: async () => {
      await redis.quit()
      await pool.end()
    },
  }
}

export function createServerApp(ctx: ServerContext): Hono<{ Variables: ServerVariables }> {
  const app = new Hono<{ Variables: ServerVariables }>()
  const userAuth = createUserAuthMiddleware(ctx.authService)
  const deviceAuth = createDeviceAuthMiddleware(ctx.deviceService)

  app.use(
    '*',
    cors({
      origin: ctx.config.corsOrigins,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Muse-Provider', 'X-Muse-Task', 'X-Muse-Selection'],
    }),
  )

  app.get(SERVER_API_PATHS.HEALTH, c => {
    const body = createHealthResponse('server', '0.0.0')
    healthResponseSchema.parse(body)
    return c.json(body)
  })

  registerAuthRoutes(app, ctx.authService)
  registerSettingsRoutes(app, ctx.settingsService, userAuth)
  registerDeviceRoutes(app, ctx.deviceService, userAuth, deviceAuth)
  registerLlmProxyRoutes(app, ctx.llmProxyOrchestrator, deviceAuth)

  return app
}
