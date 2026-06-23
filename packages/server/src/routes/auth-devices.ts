import type { Hono } from 'hono'
import {
  SERVER_API_PATHS,
  deviceHeartbeatRequestSchema,
  devicePairRequestSchema,
  loginRequestSchema,
  refreshTokenRequestSchema,
  registerRequestSchema,
} from '@muse-ai/shared'
import { AuthError, type AuthService } from '../services/auth-service.js'
import { DeviceError, type DeviceService } from '../services/device-service.js'
import type { ServerVariables } from '../types.js'

type ServerApp = Hono<{ Variables: ServerVariables }>

export function registerAuthRoutes(app: ServerApp, authService: AuthService): void {
  app.post(SERVER_API_PATHS.AUTH_REGISTER, async c => {
    const json: unknown = await c.req.json()
    const parsed = registerRequestSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    try {
      const result = await authService.register(parsed.data)
      return c.json(result, 201)
    } catch (error: unknown) {
      if (error instanceof AuthError && error.code === 'email_taken') {
        return c.json({ error: error.code, message: error.message }, 409)
      }
      throw error
    }
  })

  app.post(SERVER_API_PATHS.AUTH_LOGIN, async c => {
    const json: unknown = await c.req.json()
    const parsed = loginRequestSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    try {
      const result = await authService.login(parsed.data.email, parsed.data.password)
      return c.json(result)
    } catch (error: unknown) {
      if (error instanceof AuthError && error.code === 'invalid_credentials') {
        return c.json({ error: error.code, message: error.message }, 401)
      }
      throw error
    }
  })

  app.post(SERVER_API_PATHS.AUTH_REFRESH, async c => {
    const json: unknown = await c.req.json()
    const parsed = refreshTokenRequestSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    try {
      const result = await authService.refreshAccessToken(parsed.data.refreshToken)
      return c.json(result)
    } catch (error: unknown) {
      if (error instanceof AuthError && error.code === 'invalid_token') {
        return c.json({ error: error.code, message: error.message }, 401)
      }
      throw error
    }
  })
}

export function registerDeviceRoutes(
  app: ServerApp,
  deviceService: DeviceService,
  userAuth: ReturnType<typeof import('../middleware/user-auth.js').createUserAuthMiddleware>,
  deviceAuth: ReturnType<typeof import('../middleware/device-auth.js').createDeviceAuthMiddleware>,
): void {
  app.get(SERVER_API_PATHS.DEVICES, userAuth, async c => {
    const user = c.get('user')
    const devices = await deviceService.listForUser(user.id)
    return c.json({ devices })
  })

  app.get(SERVER_API_PATHS.DEVICE_CREDENTIALS, userAuth, async c => {
    const user = c.get('user')
    const deviceId = c.req.param('deviceId')
    try {
      const credentials = await deviceService.getCredentialsForUser(user.id, deviceId)
      return c.json(credentials)
    } catch (error: unknown) {
      if (error instanceof DeviceError) {
        const status = error.code === 'device_not_found' ? 404 : error.code === 'credentials_unavailable' ? 409 : 503
        return c.json({ error: error.code, message: error.message }, status)
      }
      throw error
    }
  })

  app.post(SERVER_API_PATHS.DEVICES_PAIR_INIT, userAuth, async c => {
    const user = c.get('user')
    const result = await deviceService.createPairCode(user.id)
    return c.json(result, 201)
  })

  app.post(SERVER_API_PATHS.DEVICES_PAIR, async c => {
    const json: unknown = await c.req.json()
    const parsed = devicePairRequestSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    try {
      const result = await deviceService.pair(parsed.data)
      return c.json(result, 201)
    } catch (error: unknown) {
      if (error instanceof DeviceError) {
        const status = error.code === 'invalid_pair_code' ? 400 : 500
        return c.json({ error: error.code, message: error.message }, status)
      }
      throw error
    }
  })

  app.post(SERVER_API_PATHS.DEVICES_HEARTBEAT, deviceAuth, async c => {
    const deviceAuth = c.get('deviceAuth')
    const json: unknown = await c.req.json().catch(() => ({}))
    const parsed = deviceHeartbeatRequestSchema.safeParse(json)
    if (!parsed.success) {
      return c.json({ error: 'invalid_request', details: parsed.error.flatten() }, 400)
    }
    try {
      const device = await deviceService.heartbeat(deviceAuth.deviceId, parsed.data)
      return c.json({ device })
    } catch (error: unknown) {
      if (error instanceof DeviceError) {
        return c.json({ error: error.code, message: error.message }, 404)
      }
      throw error
    }
  })
}
