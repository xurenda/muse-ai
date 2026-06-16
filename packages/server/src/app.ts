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
import { registerProviderRoutes } from './routes/providers.js'
import { AuthService } from './services/auth-service.js'
import { DeviceService } from './services/device-service.js'
import { LlmProxyService } from './services/llm-proxy-service.js'
import { ProviderService } from './services/provider-service.js'
import type { ServerVariables } from './types.js'

export interface ServerContext {
  config: ServerConfig
  authService: AuthService
  providerService: ProviderService
  deviceService: DeviceService
  llmProxyService: LlmProxyService
  close: () => Promise<void>
}

export async function createServerContext(config: ServerConfig): Promise<ServerContext> {
  const { db, pool } = createDb(config.databaseUrl)
  await initDatabase(pool)

  const redis = createRedis(config.redisUrl)
  await redis.connect()

  const authService = new AuthService(db, config.jwtSecret)
  const providerService = new ProviderService(db, config.encryptionKey)
  const deviceService = new DeviceService(db, redis, config.encryptionKey)
  const llmProxyService = new LlmProxyService()

  return {
    config,
    authService,
    providerService,
    deviceService,
    llmProxyService,
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
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  )

  app.get(SERVER_API_PATHS.HEALTH, c => {
    const body = createHealthResponse('server', '0.0.0')
    healthResponseSchema.parse(body)
    return c.json(body)
  })

  registerAuthRoutes(app, ctx.authService)
  registerProviderRoutes(app, ctx.providerService, userAuth)
  registerDeviceRoutes(app, ctx.deviceService, userAuth, deviceAuth)
  registerLlmProxyRoutes(app, ctx.providerService, ctx.llmProxyService, deviceAuth)

  return app
}
